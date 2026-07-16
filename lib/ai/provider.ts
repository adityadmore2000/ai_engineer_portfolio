import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

export type ChatProvider = "ollama" | "openai" | "fireworks";

export function getChatModel(): LanguageModelLike {
  const provider = (process.env.CHAT_PROVIDER || "ollama") as ChatProvider;
  const model = process.env.CHAT_MODEL || "qwen3:8b";
  const baseUrl = process.env.CHAT_BASE_URL;
  const apiKey = process.env.CHAT_API_KEY;

  switch (provider) {
    case "ollama": {
      if (!baseUrl) {
        throw new Error(
          "CHAT_BASE_URL is required for ollama provider. Set it in .env.local"
        );
      }
      return new ChatOllama({
        model,
        baseUrl,
        temperature: 0,
      });
    }
    case "openai":
    case "fireworks": {
      return new ChatOpenAI({
        model,
        temperature: 0,
        apiKey,
        configuration: baseUrl ? { baseURL: baseUrl } : undefined,
      });
    }
    default: {
      throw new Error(
        `Unsupported CHAT_PROVIDER: "${provider}". Supported: ollama, openai, fireworks.`
      );
    }
  }
}
