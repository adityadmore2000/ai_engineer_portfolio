import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Embeddings } from "@langchain/core/embeddings";

export function getEmbeddings(): Embeddings {
  const provider = process.env.EMBEDDING_PROVIDER || "huggingface";

  if (provider === "ollama") {
    return new OllamaEmbeddings({
      model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
      baseUrl: process.env.EMBEDDING_BASE_URL || "http://localhost:11434",
    });
  }

  return new HuggingFaceTransformersEmbeddings({
    model: process.env.EMBEDDING_MODEL || "Xenova/nomic-embed-text-v1.5",
  });
}
