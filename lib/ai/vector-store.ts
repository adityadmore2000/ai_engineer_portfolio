import { QdrantVectorStore } from "@langchain/qdrant";
import { getEmbeddings } from "./embeddings";

const DEFAULT_COLLECTION = "portfolio_chunks";

export async function getVectorStore() {
  const embeddings = getEmbeddings();
  const url = process.env.VECTOR_URL || "http://localhost:6333";
  const apiKey = process.env.VECTOR_API_KEY;
  const collectionName = process.env.QDRANT_COLLECTION || DEFAULT_COLLECTION;

  const config: Record<string, unknown> = {
    url,
    collectionName,
  };

  if (apiKey) {
    config.apiKey = apiKey;
  }

  return await QdrantVectorStore.fromExistingCollection(embeddings, config);
}
