import { getVectorStore } from "@/lib/ai";
import type { SearchResult } from "./types";

export async function searchSemantic(query: string, k = 5): Promise<SearchResult[]> {
  try {
    const vectorStore = await getVectorStore();
    const results = await vectorStore.similaritySearchWithScore(query, k);

    return results.map(([doc, score]) => {
      const metadata = doc.metadata || {};

      return {
        content: doc.pageContent,
        projectTitle: metadata.projectTitle as string | undefined,
        slug: metadata.slug as string | undefined,
        section: metadata.section as string | undefined,
        url: metadata.url as string | undefined,
        score,
      };
    });
  } catch (error) {
    console.error("Semantic search failed:", error);
    return [];
  }
}
