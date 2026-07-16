import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import type { Embeddings } from "@langchain/core/embeddings";

export function getEmbeddings(): Embeddings {
  return new HuggingFaceTransformersEmbeddings({
    model: process.env.EMBEDDING_MODEL || "Xenova/nomic-embed-text-v1.5",
  });
}
