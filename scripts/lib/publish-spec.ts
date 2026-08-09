import {
  serializeMarkdown,
  type ContentBlock,
} from "@/lib/content/markdown-to-pt";

/**
 * Core publish logic for the `publish-project-spec.ts` bridge.
 *
 * Given one frontmatter-stripped spec body and a metadata payload, this
 * publishes a COMPLETE project in one ordered call:
 *
 *   1. Serialize the body → content blocks FIRST (a dry-run). Serializer
 *      errors abort before any write touches Sanity.
 *   2. Write metadata — create (slug-existence check) or update (partial patch).
 *   3. If blocks exist, REPLACE `project.content` (stable content-hash `_key`s)
 *      so re-publishing is idempotent and diffable. The empty-body rule: zero
 *      blocks → skip the content patch entirely (avoids a `content` `min(1)`
 *      rejection).
 *
 * The metadata write and content patch are injected as `deps` so this module
 * is unit-testable without a live Sanity dataset (`publish-spec.test.ts`).
 */

export type PublishMode = "create" | "update";

export type PublishSpecInput = {
  mode: PublishMode;
  /** Frontmatter-stripped Markdown body (verbatim). */
  specBody: string;
  /** Metadata payload (schema field names). `__markdownDir__` excluded. */
  payload: Record<string, unknown>;
  /** Required in `update` mode: the existing project's slug. */
  slug?: string;
  /** Directory that relative metadata image paths resolve against. */
  markdownDir: string;
  /** `--check`-style: serialize only, write nothing. */
  dryRun?: boolean;
};

export type PublishSpecDeps = {
  createProject: (input: object, markdownDir: string) => Promise<void>;
  updateProject: (slug: string, input: object, markdownDir: string) => Promise<void>;
  findProjectId: (slug: string) => Promise<string>;
  patchContent: (projectId: string, blocks: ContentBlock[]) => Promise<void>;
  resolveImage: (imagePath: string, alt: string) => unknown;
};

export type PublishSpecResult = {
  mode: PublishMode;
  contentBlocks: number;
  contentPatched: boolean;
  errors: string[];
};

export async function publishSpec(
  input: PublishSpecInput,
  deps: PublishSpecDeps
): Promise<PublishSpecResult> {
  const blocks: ContentBlock[] = [];
  const errors: string[] = [];

  if (input.specBody.trim()) {
    const serialized = serializeMarkdown(input.specBody, {
      resolveImage: deps.resolveImage,
    });
    blocks.push(...serialized.blocks);
    errors.push(...serialized.errors);
  }

  // Serializer errors abort before any write (the `--check`-style dry-run
  // guarantee).
  if (errors.length) {
    return { mode: input.mode, contentBlocks: 0, contentPatched: false, errors };
  }

  if (!input.dryRun) {
    if (input.mode === "create") {
      await deps.createProject(input.payload, input.markdownDir);
    } else {
      if (!input.slug) {
        throw new Error("publish-project-spec update mode requires a slug");
      }
      await deps.updateProject(input.slug, input.payload, input.markdownDir);
    }

    // Empty-body rule: zero blocks → skip the content patch entirely.
    if (blocks.length) {
      const targetSlug =
        input.mode === "update" && input.slug ? input.slug : String(input.payload.slug ?? "");
      const projectId = await deps.findProjectId(targetSlug);
      await deps.patchContent(projectId, blocks);
    }
  }

  return {
    mode: input.mode,
    contentBlocks: blocks.length,
    contentPatched: !input.dryRun && blocks.length > 0,
    errors: [],
  };
}