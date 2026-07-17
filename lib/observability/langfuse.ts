import { Langfuse } from "langfuse";
import type {
  LangfuseTraceClient,
  LangfuseSpanClient,
  LangfuseGenerationClient,
} from "langfuse";
import { observabilityConfig } from "./config";
import type {
  ObservabilityService,
  SpanDef,
  GenerationDef,
  SpanHandle,
  GenerationHandle,
} from "./types";

const noopHandle: SpanHandle & GenerationHandle = {
  end() {},
};

class LangfuseSpanHandleImpl implements SpanHandle {
  private startTime = performance.now();

  constructor(private span: LangfuseSpanClient) {}

  end(output?: unknown, metadata?: Record<string, unknown>): void {
    try {
      const durationMs = performance.now() - this.startTime;
      this.span.end({
        output,
        metadata: { ...metadata, durationMs },
      });
    } catch (e) {
      console.warn("[Observability] span.end failed:", e);
    }
  }
}

class LangfuseGenerationHandleImpl implements GenerationHandle {
  private startTime = performance.now();

  constructor(private generation: LangfuseGenerationClient) {}

  end(output?: unknown, metadata?: Record<string, unknown>): void {
    try {
      const durationMs = performance.now() - this.startTime;
      const { promptTokens, completionTokens, totalTokens, ...rest } = (metadata || {}) as Record<
        string,
        unknown
      >;
      const usage: Record<string, unknown> = {};
      if (typeof promptTokens === "number") usage.input = promptTokens;
      if (typeof completionTokens === "number") usage.output = completionTokens;
      if (typeof totalTokens === "number") usage.total = totalTokens;
      if (Object.keys(usage).length > 0) {
        usage.unit = "TOKENS";
      }

      this.generation.end({
        output,
        ...rest,
        ...(Object.keys(usage).length > 0 ? { usage } : {}),
        metadata: { ...(rest.metadata as Record<string, unknown> | undefined), durationMs },
      });
    } catch (e) {
      console.warn("[Observability] generation.end failed:", e);
    }
  }
}

let client: Langfuse | null = null;

function getClient(): Langfuse | null {
  if (client) return client;
  const config = observabilityConfig();
  if (!config.langfuse.enabled) return null;
  try {
    client = new Langfuse({
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      baseUrl: config.langfuse.baseUrl,
    });
    return client;
  } catch (e) {
    console.warn("[Observability] Langfuse init failed:", e);
    return null;
  }
}

export class LangfuseObservabilityService implements ObservabilityService {
  private trace: LangfuseTraceClient | null = null;
  private enabled = false;

  constructor() {
    this.enabled = getClient() !== null;
  }

  ready(): boolean {
    return this.enabled;
  }

  startRequest(requestId: string, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;
    try {
      const c = getClient();
      if (!c) {
        this.enabled = false;
        return;
      }
      this.trace = c.trace({ id: requestId, name: "chat-request", metadata });
    } catch (e) {
      console.warn("[Observability] startRequest failed:", e);
      this.enabled = false;
    }
  }

  updateRequest(metadata: Record<string, unknown>): void {
    if (!this.enabled || !this.trace) return;
    try {
      this.trace.update(metadata);
    } catch (e) {
      console.warn("[Observability] updateRequest failed:", e);
    }
  }

  endRequest(): void {
    if (!this.enabled || !this.trace) return;
    try {
      this.trace.update({ metadata: { status: "success" } });
    } catch (e) {
      console.warn("[Observability] endRequest failed:", e);
    }
  }

  startSpan(def: SpanDef): SpanHandle {
    if (!this.enabled || !this.trace) return noopHandle;
    try {
      const span = this.trace.span({ name: def.name, input: def.input, ...def.metadata });
      return new LangfuseSpanHandleImpl(span);
    } catch (e) {
      console.warn("[Observability] startSpan failed:", e);
      return noopHandle;
    }
  }

  startGeneration(def: GenerationDef): GenerationHandle {
    if (!this.enabled || !this.trace) return noopHandle;
    try {
      const generation = this.trace.generation({
        name: def.name,
        input: def.input,
        ...def.metadata,
      });
      return new LangfuseGenerationHandleImpl(generation);
    } catch (e) {
      console.warn("[Observability] startGeneration failed:", e);
      return noopHandle;
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled) return;
    const c = getClient();
    if (!c) return;

    const config = observabilityConfig();
    const flushPromise = c.flushAsync().catch((err: unknown) => {
      console.warn("[Observability] flush failed:", err);
    });

    await Promise.race([
      flushPromise,
      new Promise<void>((resolve) =>
        setTimeout(resolve, config.langfuse.flushTimeoutMs)
      ),
    ]);
  }
}
