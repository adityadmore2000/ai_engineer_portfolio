import "./load-env";
import { Document } from "@langchain/core/documents";
import { getEmbeddings } from "../lib/ai/embeddings";
import {
  chunkExperience,
  chunkProject,
  chunkSiteSettings,
  chunkSkillCategory,
  chunkTechnicalNote,
  getContent,
  QdrantConnectionError,
  writeDocumentsToQdrant,
} from "../lib/indexing";

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

  const [projects, settings, experiences, skillCategories, technicalNotes] = await getContent();

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

  for (const note of technicalNotes || []) {
    documents.push(...chunkTechnicalNote(note, baseUrl));
  }

  console.log(`Generated ${documents.length} document chunks.`);

  if (documents.length === 0) {
    console.log("No documents to index. Exiting.");
    return;
  }

  console.log("Connecting to Qdrant...");

  const embeddings = await getEmbeddings();

  try {
    await writeDocumentsToQdrant(documents, embeddings, { url: vectorUrl, collectionName });

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
