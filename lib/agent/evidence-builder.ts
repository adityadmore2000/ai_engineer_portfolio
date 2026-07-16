import type { SearchResult } from "@/lib/retrieval";
import type { EvidencePackage } from "./types";

const MAX_CONTEXT_CHARS = 2000;

function deduplicate(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.content.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatContext(results: SearchResult[]): string {
  return results
    .map((r) => {
      const parts = ["Retrieved Portfolio Information:"];
      if (r.projectTitle) parts.push(`Project: ${r.projectTitle}`);
      if (r.section) parts.push(`Section: ${r.section}`);
      parts.push(`Content: ${r.content}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

export function buildEvidencePackage(results: SearchResult[]): EvidencePackage {
  const deduplicated = deduplicate(results);

  let context = formatContext(deduplicated);
  let truncated = false;

  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated due to length]";
    truncated = true;
  }

  return {
    context,
    sources: deduplicated,
    truncated,
  };
}
