import { QdrantVectorStore } from "@langchain/qdrant";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Document } from "@langchain/core/documents";

export class QdrantConnectionError extends Error {}

export class QdrantWriteError extends Error {}

export async function writeDocumentsToQdrant(
  documents: Document[],
  embeddings: Embeddings,
  config: { url: string; collectionName: string }
) {
  try {
    await QdrantVectorStore.fromDocuments(documents, embeddings, {
      url: config.url,
      collectionName: config.collectionName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("connect") ||
      message.includes("Could not connect")
    ) {
      throw new QdrantConnectionError(message);
    }

    throw new QdrantWriteError(message);
  }
}
