import { createClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "./env";

export const client = createClient({
  projectId: projectId || "missing-project-id",
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "published",
  stega: false
});

export async function sanityFetch<QueryResponse>({
  query,
  params = {}
}: {
  query: string;
  params?: Record<string, string | number | boolean>;
}): Promise<QueryResponse | null> {
  if (!isSanityConfigured) {
    return null;
  }

  try {
    return await client.fetch<QueryResponse>(query, params, {
      next: { revalidate: 60 }
    });
  } catch (error) {
    console.error("Sanity fetch failed", error);
    return null;
  }
}
