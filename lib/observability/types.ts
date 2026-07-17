export interface SpanDef {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface GenerationDef {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface SpanHandle {
  end(output?: unknown, metadata?: Record<string, unknown>): void;
}

export interface GenerationHandle {
  end(output?: unknown, metadata?: Record<string, unknown>): void;
}

export interface ObservabilityService {
  startRequest(requestId: string, metadata?: Record<string, unknown>): void;
  updateRequest(metadata: Record<string, unknown>): void;
  endRequest(): void;
  startSpan(def: SpanDef): SpanHandle;
  startGeneration(def: GenerationDef): GenerationHandle;
  flush(): Promise<void>;
}

export interface ObservabilityContext {
  requestId: string;
  service: ObservabilityService;
}
