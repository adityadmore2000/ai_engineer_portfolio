import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";
import { stripFrontMatter } from "../lib/content/discover-docs";
import {
  createProject,
  readProject,
  updateProject,
} from "./publish-tool";
import { uploadImage } from "./lib/upload";
import {
  publishSpec,
  type PublishMode,
  type PublishSpecDeps,
} from "./lib/publish-spec";

/**
 * publish-project-spec bridge.
 *
 * Publish a COMPLETE project from a single canonical `project-spec.md`: the
 * frontmatter metadata is written through the existing create/update layers,
 * and the body is deterministically serialized into `project.content` — a
 * REPLACE with stable content-hash `_key`s, idempotent and diffable. One spec,
 * one published project.
 *
 * Usage:
 *   npx tsx scripts/publish-project-spec.ts <create|update> <spec-path> <payload-json> [slug] [--check]
 */

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

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
  const modeInput = (process.argv[2] ?? "").toLowerCase();
  const specPathInput = process.argv[3];
  const payloadPathInput = process.argv[4];
  // Optional [slug] can be followed by --check; tolerate --check in that slot.
  const rawSlug = process.argv[5];
  const checkOnly = process.argv.includes("--check");
  const slug = !rawSlug || rawSlug === "--check" ? undefined : rawSlug;

  if (!["create", "update"].includes(modeInput) || !specPathInput || !payloadPathInput) {
    console.error(
      "Usage: npx tsx scripts/publish-project-spec.ts <create|update> <spec-path> <payload-json> [slug] [--check]"
    );
    process.exit(1);
  }
  const mode = modeInput as PublishMode;
  if (mode === "update" && !slug) {
    console.error("update mode requires a <slug> argument.");
    process.exit(1);
  }

  const specPath = path.resolve(specPathInput);
  if (!fs.existsSync(specPath)) {
    console.error(`Spec not found: ${specPath}`);
    process.exit(1);
  }

  const payloadPath = path.resolve(payloadPathInput);
  if (!fs.existsSync(payloadPath)) {
    console.error(`Payload not found: ${payloadPath}`);
    process.exit(1);
  }

  const specRaw = fs.readFileSync(specPath, "utf-8");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8")) as Record<
    string,
    unknown
  >;

  // Relative metadata image paths resolve against the spec's directory via
  // `__markdownDir__` when present (agent flow); otherwise the payload file's
  // directory (legacy callers).
  const declaredDir = payload.__markdownDir__;
  delete payload.__markdownDir__;
  const markdownDir =
    typeof declaredDir === "string" ? path.resolve(declaredDir) : path.dirname(payloadPath);

  // Body image references (absolute paths) resolve against the spec's directory.
  const specDir = path.dirname(specPath);
  const specBody = stripFrontMatter(specRaw).raw;

  const client = getWriteClient();

  const deps: PublishSpecDeps = {
    createProject: (spec, createMarkdownDir) =>
      createProject(
        spec as unknown as Parameters<typeof createProject>[0],
        createMarkdownDir
      ),
    updateProject: (updateSlug, updatePayload) =>
      updateProject(
        updateSlug,
        updatePayload as unknown as Parameters<typeof updateProject>[1],
        markdownDir
      ),
    findProjectId: async (targetSlug: string) => {
      const project = await readProject(targetSlug);
      if (!project) {
        throw new Error(`Project not found after write: ${targetSlug}`);
      }
      return project._id;
    },
    patchContent: async (projectId: string, content) => {
      await client.patch(projectId).set({ content }).commit();
    },
    resolveImage: async (imagePath, alt) => {
      if (!imagePath.startsWith("/")) {
        throw new Error(`Image path must be absolute (got "${imagePath}").`);
      }
      const ref = await uploadImage(client, imagePath.slice(1), specDir);
      if (ref && alt) {
        ref.alt = alt;
      }
      return ref;
    },
  };

  const result = await publishSpec(
    { mode, specBody, payload, slug, markdownDir, dryRun: checkOnly },
    deps
  );

  if (result.errors.length) {
    console.error("Serializer errors:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const verb = checkOnly
    ? "checked"
    : mode === "create"
      ? "created"
      : "updated";
  const contentNote = checkOnly
    ? ` (serialized ${result.contentBlocks} blocks, dry-run)`
    : result.contentPatched
      ? ` and content replaced (${result.contentBlocks} blocks)`
      : " (no body content — content skipped)";
  console.log(
    `\n✅ ${verb[0].toUpperCase()}${verb.slice(1)} project "${slug ?? payload.slug}"${contentNote}. Metadata written.`
  );
}

void main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});