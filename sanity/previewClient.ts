import "server-only";
import { createClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "./env";

type SanityFetchParams = Record<string, string | number | boolean>;

export const previewClient = createClient({
  projectId: projectId || "missing-project-id",
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "drafts",
  stega: false,
  token: process.env.SANITY_API_READ_TOKEN
});

export async function previewSanityFetch<QueryResponse>({
  query,
  params = {}
}: {
  query: string;
  params?: SanityFetchParams;
}): Promise<QueryResponse | null> {
  if (!isSanityConfigured) {
    throw new Error("Draft preview requested but Sanity is not configured.");
  }

  if (!process.env.SANITY_API_READ_TOKEN) {
    throw new Error("Draft preview requested without SANITY_API_READ_TOKEN.");
  }

  return previewClient.fetch<QueryResponse>(query, params, {
    cache: "no-store"
  });
}
