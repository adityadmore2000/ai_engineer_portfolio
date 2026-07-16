import { ChatOpenAI } from "@langchain/openai";

function vllmClient() {
  const baseUrl = process.env.VLLM_BASE_URL || "http://localhost:8000/v1";
  const apiKey = process.env.VLLM_API_KEY || "EMPTY";
  const model = process.env.CHAT_MODEL || "Qwen/Qwen3-4B-Instruct";

  return new ChatOpenAI({
    model,
    temperature: 0,
    apiKey,
    configuration: { baseURL: baseUrl },
  });
}

export function getChatModel() {
  return vllmClient();
}

export function getIntentModel() {
  return vllmClient();
}
