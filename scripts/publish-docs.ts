import "./load-env";
import { createClient } from "@sanity/client";
import path from "node:path";
import { apiVersion, dataset, projectId } from "../sanity/env";
import { discoverDocs } from "../lib/content/discover-docs";
import {
  serializeMarkdown,
  type ContentBlock,
} from "../lib/content/markdown-to-pt";
import { readProject } from "./publish-tool";
import { uploadImage } from "./lib/upload";

/**
 * publish-docs bridge.
 *
 * Discovers the Markdown documents in a project's `docs/` directory,
 * deterministically serializes each to Portable Text blocks, uploads any
 * referenced images (absolute paths only), and patches `project.content` — a
 * REPLACE of the narrative with stable content-hash `_key`s so re-runs are
 * idempotent. It never mutates metadata.
 *
 * Usage:
 *   npx tsx scripts/publish-docs.ts <slug> <docs-dir> [--check]
 */

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

// Canonical document order for committed project docs dirs. Docs discovered
// without a matching filename fall back to their `order` front-matter, then to
// alphabetical order.
const FILENAME_ORDER: Record<string, number> = {
  "overview.md": 1,
  "architecture.md": 2,
  "engineering-decisions.md": 3,
  "challenges.md": 4,
  "results.md": 5,
  "demonstrates.md": 6,
  "examples.md": 7,
  "lessons-and-limitations.md": 8,
  "future-improvements.md": 9,
  "timeline.md": 10,
  "faq.md": 11,
};

function getWriteClient() {
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

async function main() {
  const slug = process.argv[2];
  const docsDirInput = process.argv[3];
  const checkOnly = process.argv.includes("--check");

  if (!slug || !docsDirInput) {
    console.error(
      "Usage: npx tsx scripts/publish-docs.ts <slug> <docs-dir> [--check]"
    );
    process.exit(1);
  }

  const docsDir = path.resolve(docsDirInput);

  const project = await readProject(slug);
  if (!project) {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }

  const docs = discoverDocs(docsDir, { filenameOrder: FILENAME_ORDER });
  if (!docs.length) {
    console.error(`No Markdown documents found in ${docsDir}`);
    process.exit(1);
  }

  const client = getWriteClient();
  const resolveImage = async (imagePath: string, alt: string) => {
    if (!imagePath.startsWith("/")) {
      throw new Error(`Image path must be absolute (got "${imagePath}").`);
    }
    const ref = await uploadImage(client, imagePath.slice(1), docsDir);
    if (ref && alt) {
      ref.alt = alt;
    }
    return ref;
  };

  const blocks: ContentBlock[] = [];
  const errors: string[] = [];

  console.log(`\n  ${slug} — publishing ${docs.length} documents`);
  for (const doc of docs) {
    const { blocks: docBlocks, errors: docErrors } = serializeMarkdown(
      doc.raw,
      { heading: doc.heading, resolveImage }
    );
    errors.push(...docErrors.map((e) => `${doc.file}: ${e}`));
    blocks.push(...docBlocks);
    console.log(`  • ${doc.file} → ${docBlocks.length} blocks`);
  }

  if (errors.length) {
    console.error("\n❌ Serializer errors:");
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  if (checkOnly) {
    console.log(
      `\n✅ --check passed: serialized ${blocks.length} blocks (images uploaded).`
    );
    return;
  }

  await client.patch(project._id).set({ content: blocks }).commit();
  console.log(
    `\n✅ Patched content on "${slug}" (${blocks.length} blocks). Metadata untouched.`
  );
}

void main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});