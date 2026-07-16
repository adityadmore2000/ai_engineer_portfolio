import { OllamaEmbeddings } from "@langchain/ollama";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { Embeddings } from "@langchain/core/embeddings";

export type EmbeddingProvider = "ollama" | "openai";

export function getEmbeddings(): Embeddings {
  const provider = (process.env.EMBEDDING_PROVIDER || "ollama") as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const baseUrl = process.env.EMBEDDING_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;

  switch (provider) {
    case "ollama": {
      if (!baseUrl) {
        throw new Error(
          "EMBEDDING_BASE_URL is required for ollama provider. Set it in .env.local"
        );
      }
      return new OllamaEmbeddings({
        model,
        baseUrl,
      });
    }
    case "openai": {
      return new OpenAIEmbeddings({
        model,
        apiKey,
        configuration: baseUrl ? { baseURL: baseUrl } : undefined,
      });
    }
    default: {
      throw new Error(
        `Unsupported EMBEDDING_PROVIDER: "${provider}". Supported: ollama, openai.`
      );
    }
  }
}
