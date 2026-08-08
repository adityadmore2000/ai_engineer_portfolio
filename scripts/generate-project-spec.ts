import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { readProject } from "./publish-tool";
import { generateProjectSpec } from "./lib/generate-project-spec";

/**
 * One-off migration bridge: converts a committed `projects/<slug>/docs/**`
 * tree into the canonical `projects/<slug>/project-spec.md`, relocates any
 * referenced image assets into `projects/<slug>/images/`, and — after the
 * content-equality gate passes — deletes the `docs/` tree so the spec becomes
 * the only narrative source.
 *
 * The equality gate serializes the old per-doc body and the new single spec
 * body and requires block-for-block equality (same headings, blocks, stable
 * `_key`s; the new `{#id}` anchors must equal `generateHeadingId` of the old
 * heading text). On any mismatch the bridge exits nonzero and touches nothing.
 *
 * Usage:
 *   npx tsx scripts/generate-project-spec.ts <slug> <docs-dir> [--check]
 */
async function main() {
  const slug = process.argv[2];
  const docsDirInput = process.argv[3];
  const checkOnly = process.argv.includes("--check");

  if (!slug || !docsDirInput) {
    console.error(
      "Usage: npx tsx scripts/generate-project-spec.ts <slug> <docs-dir> [--check]"
    );
    process.exit(1);
  }

  const docsDir = path.resolve(docsDirInput);
  const specDir = path.dirname(docsDir);

  const existing = await readProject(slug);
  if (existing) {
    console.log(`\n  Project metadata loaded from Sanity: "${existing.title}"`);
  } else {
    console.log(
      `\n  Project "${slug}" not found in Sanity — using slug-derived metadata.`
    );
  }

  let generated;
  try {
    generated = generateProjectSpec({ slug, docsDir, specDir, existing });
  } catch (error) {
    console.error(`\n❌ Migration failed for "${slug}":`);
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (generated.equalityErrors.length) {
    console.error(`\n❌ Equality check FAILED for "${slug}":`);
    for (const error of generated.equalityErrors) {
      console.error(`  - ${error}`);
    }
    console.error(
      "  No spec written, no images moved, docs untouched — migration aborted."
    );
    process.exit(1);
  }

  console.log(
    `\n✅ Content equality passed for "${slug}" (${generated.oldBlocks.length} blocks, old → new identical).`
  );

  if (generated.moves.length) {
    for (const move of generated.moves) {
      console.log(
        `  ⏵ image  ${path.relative(specDir, move.from)} → ${path.relative(specDir, move.to)} (${move.newRefUrl})`
      );
    }
  }

  if (checkOnly) {
    console.log(`\n  --check: no files written.\n`);
    process.exit(0);
  }

  const specPath = path.join(specDir, "project-spec.md");
  fs.writeFileSync(specPath, generated.spec, "utf-8");
  console.log(`\n  ✓ wrote ${path.relative(process.cwd(), specPath)}`);

  for (const move of generated.moves) {
    fs.mkdirSync(path.dirname(move.to), { recursive: true });
    fs.copyFileSync(move.from, move.to);
    fs.rmSync(move.from, { force: true });
    console.log(
      `  ✓ relocated ${path.relative(specDir, move.from)} → ${path.relative(specDir, move.to)}`
    );
  }

  fs.rmSync(docsDir, { recursive: true, force: true });
  console.log(`  ✓ removed ${path.relative(process.cwd(), docsDir)}/`);

  console.log(`\n✅ Migrated project "${slug}" to canonical project-spec.md.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});