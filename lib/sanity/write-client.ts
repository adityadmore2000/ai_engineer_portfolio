import "server-only";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../../sanity/env";

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

export function getWriteClient() {
  if (!writeToken) {
    throw new Error(
      "SANITY_API_WRITE_TOKEN is required. Add it to your .env.local file."
    );
  }
  if (!projectId) {
    throw new Error(
      "NEXT_PUBLIC_SANITY_PROJECT_ID is required. Add it to your .env.local file."
    );
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: writeToken,
  });
}
