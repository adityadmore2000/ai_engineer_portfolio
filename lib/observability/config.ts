export interface LangfuseConfig {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  flushTimeoutMs: number;
}

export interface ObservabilityConfig {
  langfuse: LangfuseConfig;
}

export function observabilityConfig(): ObservabilityConfig {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || "";
  const secretKey = process.env.LANGFUSE_SECRET_KEY || "";
  const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";
  const flushTimeoutMs = Number(process.env.LANGFUSE_FLUSH_TIMEOUT_MS) || 5000;

  const enabled = !!(publicKey && secretKey);

  return {
    langfuse: { enabled, publicKey, secretKey, baseUrl, flushTimeoutMs },
  };
}
