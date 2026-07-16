import fs from "node:fs/promises";
import path from "node:path";

type MlflowRunStatus = "FINISHED" | "FAILED";

/**
 * Thin wrapper over the MLflow Tracking REST API.
 *
 * All methods are best-effort — fetch failures are caught and logged as
 * warnings.  The logger is a no-op when MLFLOW_TRACKING_URI is unset.
 *
 * Metrics are staged in memory and flushed as a batch on endRun().
 * Params and artifacts are written immediately (fire-and-forget).
 */
class MLflowLogger {
  private enabled: boolean;
  private trackingUri: string;
  private runId: string | null = null;
  private experimentId: string | null = null;
  private artifactUri: string | null = null;
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

      const res = await this.mlflowFetch("/api/2.0/mlflow/runs/create", body);
      if (!res.ok) {
        console.warn("MLflow: failed to create run", await res.text());
        this.enabled = false;
        return;
      }

      const data = await res.json();
      this.runId = data.run.info.run_id;
      this.artifactUri = data.run.info.artifact_uri;
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

  /** Write content to an artifact file under the run's artifact_uri. */
  logArtifact(content: string, artifactPath: string): void {
    if (!this.enabled || !this.runId || !this.artifactUri) return;

    this.writeArtifactFile(content, artifactPath).catch((err) =>
      console.warn("MLflow: logArtifact failed", err),
    );
  }

  async endRun(status: MlflowRunStatus = "FINISHED"): Promise<void> {
    if (!this.enabled || !this.runId) return;

    try {
      await this.flushBatch();
      await this.mlflowFetch("/api/2.0/mlflow/runs/update", {
        run_id: this.runId,
        status,
        end_time: Date.now(),
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

  private mlflowFetch(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.trackingUri}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async resolveExperimentId(name: string): Promise<string | null> {
    const getRes = await this.mlflowFetch(
      "/api/2.0/mlflow/experiments/get-by-name",
      { experiment_name: name },
    );

    if (getRes.ok) {
      const data = await getRes.json();
      return data.experiment.experiment_id;
    }

    const createRes = await this.mlflowFetch("/api/2.0/mlflow/experiments/create", {
      name,
      artifact_location: process.env.MLFLOW_ARTIFACT_LOCATION || undefined,
    });

    if (!createRes.ok) {
      console.warn("MLflow: failed to create experiment", await createRes.text());
      return null;
    }

    const data = await createRes.json();
    return data.experiment.experiment_id;
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

    const res = await this.mlflowFetch("/api/2.0/mlflow/runs/log-batch", body);
    if (!res.ok) {
      console.warn("MLflow: log-batch failed", await res.text());
    }
  }

  private async writeArtifactFile(
    content: string,
    artifactPath: string,
  ): Promise<void> {
    let baseDir = this.artifactUri!;
    if (baseDir.startsWith("file://")) {
      baseDir = baseDir.slice(7);
    }
    const fullPath = path.join(baseDir, artifactPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }
}

export { MLflowLogger };
