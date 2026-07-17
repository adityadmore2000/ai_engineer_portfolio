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

export class NoopObservabilityService implements ObservabilityService {
  startRequest(): void {}
  updateRequest(): void {}
  endRequest(): void {}
  startSpan(_: SpanDef): SpanHandle {
    return noopHandle;
  }
  startGeneration(_: GenerationDef): GenerationHandle {
    return noopHandle;
  }
  async flush(): Promise<void> {}
}
