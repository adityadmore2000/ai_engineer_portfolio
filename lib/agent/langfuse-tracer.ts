import {
  Langfuse,
  LangfuseTraceClient,
  LangfuseSpanClient,
  LangfuseGenerationClient,
} from "langfuse";

let client: Langfuse | null = null;
let initialized = false;

interface GenerationInput {
  messages: unknown[];
  model: string;
  modelParameters?: Record<string, unknown>;
  systemPrompt?: string;
  evidence?: string;
}

function getClient(): Langfuse | null {
  if (initialized) return client;
  initialized = true;

  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) return null;

  try {
    client = new Langfuse({
      publicKey: pk,
      secretKey: sk,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    });
  } catch {
    // Langfuse unavailable — remain disabled
  }
  return client;
}

export class LangfuseTracer {
  private trace: LangfuseTraceClient | null = null;
  private spans = new Map<string, LangfuseSpanClient | LangfuseGenerationClient>();
  private cl: Langfuse | null;

  constructor() {
    this.cl = getClient();
  }

  get isEnabled(): boolean {
    return this.cl !== null;
  }

  startTrace(name: string, input?: unknown): void {
    if (!this.cl) return;
    try {
      this.trace = this.cl.trace({ name, input });
    } catch {
      // best-effort
    }
  }

  startSpan(name: string, input?: unknown): string | null {
    if (!this.cl || !this.trace) return null;
    try {
      const span = this.trace.span({ name, input });
      const id = crypto.randomUUID();
      this.spans.set(id, span);
      return id;
    } catch {
      return null;
    }
  }

  endSpan(id: string | null, output?: unknown): void {
    if (!id) return;
    try {
      const span = this.spans.get(id);
      if (span) {
        span.end({ output });
        this.spans.delete(id);
      }
    } catch {
      // best-effort
    }
  }

  startGeneration(name: string, input: GenerationInput): string | null {
    if (!this.cl || !this.trace) return null;
    try {
      const gen = this.trace.generation({
        name,
        model: input.model,
        modelParameters: input.modelParameters as Record<string, string | number | boolean | string[] | null> | undefined,
        input: input.messages,
        metadata: {
          systemPrompt: input.systemPrompt ?? "",
          evidence: input.evidence ?? "",
        },
      });
      const id = crypto.randomUUID();
      this.spans.set(id, gen);
      return id;
    } catch {
      return null;
    }
  }

  endGeneration(
    id: string | null,
    output: {
      response: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      metadata?: Record<string, unknown>;
    },
  ): void {
    if (!id) return;
    try {
      const gen = this.spans.get(id);
      if (gen) {
        gen.end({ output: output.response, usage: output.usage, metadata: output.metadata });
        this.spans.delete(id);
      }
    } catch {
      // best-effort
    }
  }

  recordError(id: string | null, error: Error | string): void {
    if (!id) return;
    try {
      const span = this.spans.get(id);
      if (span) {
        span.end({
          level: "ERROR",
          statusMessage: typeof error === "string" ? error : error.message,
        });
        this.spans.delete(id);
      }
    } catch {
      // best-effort
    }
  }

  endTrace(output?: unknown): void {
    if (!this.cl || !this.trace) return;
    try {
      this.trace.update({ output });
    } catch {
      // best-effort
    } finally {
      this.trace = null;
      this.spans.clear();
    }
  }

  async flushAsync(): Promise<void> {
    if (!this.cl) return;
    try {
      await this.cl.flushAsync();
    } catch {
      // best-effort
    }
  }
}
