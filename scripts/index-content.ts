import "./load-env";
import { createHash } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { getEmbeddingModel, getEmbeddings } from "../lib/ai/embeddings";
import {
  chunkExperience,
  chunkProject,
  chunkSiteSettings,
  chunkSkillCategory,
  getContent,
  QdrantConnectionError,
} from "../lib/indexing";
import { IndexTransactionManager } from "../lib/indexing/transaction";
import type { SemanticProbe } from "../lib/indexing/transaction";

function computeContentRevision(content: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex");
}

function buildSemanticProbes(
  projects: Awaited<ReturnType<typeof getContent>>[0]
): SemanticProbe[] {
  const probes: SemanticProbe[] = [];
  for (const project of projects || []) {
    const title = project.title?.trim();
    if (title) {
      probes.push({ label: `project:${title}`, query: title, expected: title });
    }
  }
  return probes.slice(0, 5);
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) {
    console.warn(
      "ℹ  NEXT_PUBLIC_SANITY_PROJECT_ID is not set. Using fallback content.\n" +
      "   Copy .env.example to .env.local and fill in your Sanity project ID to use live content."
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const vectorUrl = process.env.VECTOR_URL || "http://localhost:6333";
  const collectionName = process.env.QDRANT_COLLECTION || "portfolio_chunks";

  const [projects, settings, experiences, skillCategories] = await getContent();

  const documents: Document[] = [];

  for (const project of projects || []) {
    documents.push(...chunkProject(project, baseUrl));
  }

  if (settings) {
    documents.push(...chunkSiteSettings(settings, baseUrl));
  }

  for (const exp of experiences || []) {
    documents.push(...chunkExperience(exp, baseUrl));
  }

  for (const cat of skillCategories || []) {
    documents.push(...chunkSkillCategory(cat, baseUrl));
  }

  console.log(`Generated ${documents.length} document chunks.`);

  if (documents.length === 0) {
    console.log("No documents to index. Exiting.");
    return;
  }

  console.log("Connecting to Qdrant...");

  const embeddings = await getEmbeddings();

  const semanticProbes = buildSemanticProbes(projects);
  const provenance = {
    trigger: process.env.INDEX_TRIGGER || "manual",
    initiatedBy: process.env.INDEX_INITIATED_BY || "index-content",
    embeddingModel: getEmbeddingModel(),
    sanityRevision: computeContentRevision([
      projects,
      settings,
      experiences,
      skillCategories,
    ]),
  };

  const manager = new IndexTransactionManager({
    qdrant: {
      url: vectorUrl,
      apiKey: process.env.VECTOR_API_KEY,
    },
    productionCollection: collectionName,
    tempCollectionPrefix: process.env.QDRANT_TEMP_COLLECTION_PREFIX,
    journalDir: process.env.QDRANT_TXN_JOURNAL_DIR,
  });

  try {
    await manager.run({
      documents,
      embeddings,
      provenance,
      semanticProbes,
    });

    console.log(`\n✅ Indexed ${documents.length} chunks into Qdrant collection "${collectionName}".`);
  } catch (error) {
    if (error instanceof QdrantConnectionError) {
      console.error(
        `\n❌ Could not connect to Qdrant at ${vectorUrl}.\n` +
        `   Make sure Qdrant is running:\n` +
        `     docker compose up -d\n` +
        `   Or set VECTOR_URL in .env.local if using a different address.`
      );
    } else {
      console.error(`\n❌ Qdrant error: ${error instanceof Error ? error.message : String(error)}`);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Indexing failed:", error);
  process.exit(1);
});
