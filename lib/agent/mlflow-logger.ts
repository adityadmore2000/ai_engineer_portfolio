type MlflowRunStatus = "FINISHED" | "FAILED";

let cachedExperimentId: string | null = null;

/**
 * Thin wrapper over the MLflow Tracking REST API.
 *
 * All methods are best-effort — fetch failures are caught and logged as
 * warnings.  The logger is a no-op when MLFLOW_TRACKING_URI is unset.
 *
 * Metrics are staged in memory and flushed as a batch on endRun().
 * Params are logged eagerly before endRun (staged, then flushed).
 */
class MLflowLogger {
  private enabled: boolean;
  private trackingUri: string;
  private runId: string | null = null;
  private experimentId: string | null = null;
  private params: Record<string, string> = {};
  private metrics: Record<string, number> = {};

  constructor() {
    const uri = process.env.MLFLOW_TRACKING_URI;
    this.enabled = !!uri;
    this.trackingUri = (uri || "").replace(/\/+$/, "");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async startRun(experimentName?: string): Promise<void> {
    if (!this.enabled) return;

    const expName =
      experimentName ||
      process.env.MLFLOW_EXPERIMENT_NAME ||
      "portfolio-chat";

    try {
      const experimentId = await this.resolveExperimentId(expName);
      if (!experimentId) {
        this.enabled = false;
        return;
      }
      this.experimentId = experimentId;

      const body = {
        experiment_id: this.experimentId,
        run_name: `chat-${Date.now()}`,
        start_time: Date.now(),
        tags: [{ key: "mlflow.runName", value: `chat-${Date.now()}` }],
      };

      const res = await this.mlflowFetch("/api/2.0/mlflow/runs/create", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        this.logMlflowError(
          "/api/2.0/mlflow/runs/create",
          "POST",
          res.status,
          await res.text(),
        );
        this.enabled = false;
        return;
      }

      const data = await res.json();
      this.runId = data.run.info.run_id;
    } catch (err) {
      console.warn("MLflow: startRun failed", err);
      this.enabled = false;
    }
  }

  /** Stage parameters for batch-logging on endRun(). */
  logParams(params: Record<string, string>): void {
    if (!this.enabled || !this.runId) return;
    Object.assign(this.params, params);
  }

  /** Stage a metric for batch-logging on endRun(). */
  logMetric(key: string, value: number): void {
    if (!this.enabled || !this.runId) return;
    this.metrics[key] = value;
  }

  async endRun(status: MlflowRunStatus = "FINISHED"): Promise<void> {
    if (!this.enabled || !this.runId) return;

    try {
      await this.flushBatch();
      await this.mlflowFetch("/api/2.0/mlflow/runs/update", {
        method: "POST",
        body: { run_id: this.runId, status, end_time: Date.now() },
      });
    } catch (err) {
      console.warn("MLflow: endRun failed", err);
    } finally {
      this.runId = null;
      this.params = {};
      this.metrics = {};
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async mlflowFetch(
    endpoint: string,
    options: { method: "GET" | "POST"; body?: unknown },
  ): Promise<Response> {
    const { method, body } = options;
    const url = new URL(`${this.trackingUri}${endpoint}`);

    if (method === "GET" && body !== undefined) {
      for (const [key, value] of Object.entries(
        body as Record<string, string>,
      )) {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      }
    }

    const init: RequestInit = { method };
    if (method !== "GET" && body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }

    return fetch(url.toString(), init);
  }

  private logMlflowError(
    endpoint: string,
    method: string,
    status: number,
    responseText: string,
  ): void {
    console.warn(
      `MLflow request failed\nEndpoint: ${endpoint}\nMethod: ${method}\nStatus: ${status}\nResponse: ${responseText}`,
    );
  }

  private async resolveExperimentId(name: string): Promise<string | null> {
    if (cachedExperimentId) return cachedExperimentId;

    const getRes = await this.mlflowFetch(
      "/api/2.0/mlflow/experiments/get-by-name",
      { method: "GET", body: { experiment_name: name } },
    );

    if (getRes.ok) {
      const data = await getRes.json();
      cachedExperimentId = data.experiment.experiment_id;
      return cachedExperimentId;
    }

    if (getRes.status !== 404) {
      this.logMlflowError(
        "/api/2.0/mlflow/experiments/get-by-name",
        "GET",
        getRes.status,
        await getRes.text(),
      );
      return null;
    }

    const createRes = await this.mlflowFetch(
      "/api/2.0/mlflow/experiments/create",
      {
        method: "POST",
        body: {
          name,
          artifact_location:
            process.env.MLFLOW_ARTIFACT_LOCATION || undefined,
        },
      },
    );

    if (createRes.ok) {
      const data = await createRes.json();
      cachedExperimentId = data.experiment.experiment_id;
      return cachedExperimentId;
    }

    if (createRes.status === 400 || createRes.status === 409) {
      const errBody = await createRes.json().catch(() => null);
      if (errBody?.error_code === "RESOURCE_ALREADY_EXISTS") {
        const retryRes = await this.mlflowFetch(
          "/api/2.0/mlflow/experiments/get-by-name",
          { method: "GET", body: { experiment_name: name } },
        );
        if (retryRes.ok) {
          const data = await retryRes.json();
          cachedExperimentId = data.experiment.experiment_id;
          return cachedExperimentId;
        }
        this.logMlflowError(
          "/api/2.0/mlflow/experiments/get-by-name",
          "GET",
          retryRes.status,
          await retryRes.text(),
        );
        return null;
      }
    }

    this.logMlflowError(
      "/api/2.0/mlflow/experiments/create",
      "POST",
      createRes.status,
      await createRes.text(),
    );
    return null;
  }

  private async flushBatch(): Promise<void> {
    const hasParams = Object.keys(this.params).length > 0;
    const hasMetrics = Object.keys(this.metrics).length > 0;
    if (!hasParams && !hasMetrics) return;

    const body: Record<string, unknown> = { run_id: this.runId };

    if (hasParams) {
      body.params = Object.entries(this.params).map(([key, value]) => ({
        key,
        value,
      }));
    }

    if (hasMetrics) {
      const now = Date.now();
      body.metrics = Object.entries(this.metrics).map(([key, value]) => ({
        key,
        value,
        timestamp: now,
        step: 0,
      }));
    }

    const res = await this.mlflowFetch("/api/2.0/mlflow/runs/log-batch", {
      method: "POST",
      body,
    });
    if (!res.ok) {
      this.logMlflowError(
        "/api/2.0/mlflow/runs/log-batch",
        "POST",
        res.status,
        await res.text(),
      );
    }
  }

}

export { MLflowLogger };
