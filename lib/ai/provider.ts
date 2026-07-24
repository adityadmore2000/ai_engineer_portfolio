import { ChatOpenAI } from "@langchain/openai";

function resolveBaseUrl(): string {
  if (process.env.VLLM_BASE_URL) return process.env.VLLM_BASE_URL;
  if (process.env.CHAT_BASE_URL) {
    const base = process.env.CHAT_BASE_URL.replace(/\/+$/, "");
    return `${base}/v1`;
  }
  return "http://localhost:8000/v1";
}

function createLLMClient(modelOverride?: string) {
  const baseUrl = resolveBaseUrl();
  const apiKey = process.env.VLLM_API_KEY || process.env.CHAT_API_KEY || "EMPTY";
  const model = modelOverride || process.env.CHAT_MODEL || "Qwen/Qwen3-4B-Instruct";

  return new ChatOpenAI({
    model,
    temperature: 0,
    apiKey,
    timeout: 180000,
    maxRetries: 1,
    maxTokens: 4096,
    configuration: { baseURL: baseUrl },
  });
}

export function getChatModel() {
  return createLLMClient();
}

export function getIntentModel() {
  return createLLMClient();
}
