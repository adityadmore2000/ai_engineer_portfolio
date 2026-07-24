import type { Embeddings } from "@langchain/core/embeddings";

export async function getEmbeddings(): Promise<Embeddings> {
  const provider = process.env.EMBEDDING_PROVIDER || "ollama";

  if (provider === "openai") {
    const { OpenAIEmbeddings } = await import("@langchain/openai");
    return new OpenAIEmbeddings({
      model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      apiKey: process.env.OPENAI_API_KEY || process.env.CHAT_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL || process.env.CHAT_BASE_URL
          ? `${(process.env.OPENAI_BASE_URL || process.env.CHAT_BASE_URL || "").replace(/\/+$/, "")}/v1`
          : undefined,
      },
    });
  }

  if (provider === "huggingface") {
    throw new Error(
      "HuggingFace embeddings are deprecated for serverless. " +
      "Use EMBEDDING_PROVIDER=ollama or EMBEDDING_PROVIDER=openai instead. " +
      "To restore HuggingFace support, install @langchain/community and @huggingface/transformers as optional dependencies."
    );
  }

  const { OllamaEmbeddings } = await import("@langchain/ollama");
  return new OllamaEmbeddings({
    model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
    baseUrl: process.env.EMBEDDING_BASE_URL || "http://localhost:11434",
  });
}
