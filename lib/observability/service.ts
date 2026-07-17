import { observabilityConfig } from "./config";
import { LangfuseObservabilityService } from "./langfuse";
import { NoopObservabilityService } from "./noop";
import type { ObservabilityService } from "./types";

export function createObservabilityService(): ObservabilityService {
  const config = observabilityConfig();
  if (config.langfuse.enabled) {
    const svc = new LangfuseObservabilityService();
    if (!svc.ready()) {
      console.warn(
        "[Observability] Langfuse initialization failed — request tracing is disabled."
      );
    }
    return svc;
  }
  if (process.env.LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_SECRET_KEY) {
    console.warn(
      "[Observability] LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must both be set for tracing. One is missing — traces will not be recorded."
    );
  }
  return new NoopObservabilityService();
}
