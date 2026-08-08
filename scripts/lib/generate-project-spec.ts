import fs from "node:fs";
import path from "node:path";
import { dump as dumpYaml } from "js-yaml";
import {
  discoverDocs,
  type DiscoveredDoc,
} from "../../lib/content/discover-docs";
import {
  serializeMarkdown,
  type ContentBlock,
} from "../../lib/content/markdown-to-pt";
import { generateHeadingId } from "../../lib/content/headings";

/**
 * Pure migration logic for `scripts/generate-project-spec.ts`.
 *
 * Converts a committed `projects/<slug>/docs/**` tree into the canonical
 * `projects/<slug>/project-spec.md` format, and verifies **content equality**
 * between the two forms: the old per-doc serialization (with the `heading`
 * option) and the new single-body serialization must produce identical
 * Portable Text blocks once explicit `{#id}` anchors are accounted for.
 *
 * The frontmatter is built from the live Sanity metadata (schema field names);
 * image assets referenced from the docs are relocated into `<spec>/images/`
 * and their Markdown refs rewritten so absolute-path resolution keeps working
 * against the spec's directory.
 *
 * Deterministic and re-runnable: stable content-hash `_key`s mean identical
 * input produces identical output.
 */

// Canonical document order for committed project docs dirs, mirroring
// `scripts/publish-docs.ts:31` (kept in sync until Phase 7 removes the
// legacy docs path entirely).
export const FILENAME_ORDER: Record<string, number> = {
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

/** Frontmatter key emission order (== Sanity schema field names). */
const FRONTMATTER_KEY_ORDER = [
  "slug",
  "title",
  "shortSummary",
  "status",
  "technologies",
  "keyMetrics",
  "githubUrl",
  "demoUrl",
  "demoVideo",
  "coverImage",
  "coverImageAlt",
  "screenshots",
  "screenshotAlts",
  "featured",
  "displayOrder",
];

const HEADING_LINE_RE = /^(#{1,6})\s+(.+?)\s*$/m;
const CODE_FENCE_RE = /^\s*(```|~~~)/;
const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Metadata actually available from the read bridge (subset of a project). */
export type ExistingProjectLike = {
  slug: string;
  title: string;
  shortSummary?: string;
  status?: string;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  demoVideo?: string;
  featured?: boolean;
  displayOrder?: number;
};

/** A relocation plan for an image referenced by a docs file. */
export type ImageMove = {
  /** Original Markdown ref (e.g. `/architecture-diagram.png`). */
  refUrl: string;
  /** Rewritten ref (e.g. `/images/architecture-diagram.png`). */
  newRefUrl: string;
  /** Existing absolute file path under the docs dir. */
  from: string;
  /** Target absolute file path under `specDir/images`. */
  to: string;
};

export type GenerateProjectSpecInput = {
  slug: string;
  /** The `projects/<slug>/docs` directory (frontmatter-stripped bodies). */
  docsDir: string;
  /** The project root — where `project-spec.md` and `images/` live. */
  specDir: string;
  /** Optional metadata from Sanity; falls back to slug-derived fields. */
  existing: ExistingProjectLike | null;
  /** Placeholder resolvers for tests; the live bridge uploads to Sanity. */
  resolveImage?: (imagePath: string, alt: string) => unknown;
};

export type GenerateProjectSpecResult = {
  spec: string;
  frontmatter: string;
  body: string;
  metadata: Record<string, unknown>;
  docs: DiscoveredDoc[];
  rewrites: Record<string, string>;
  moves: ImageMove[];
  oldBlocks: ContentBlock[];
  newBlocks: ContentBlock[];
  equalityErrors: string[];
};

export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function hasMarkdownHeading(md: string): boolean {
  return HEADING_LINE_RE.test(md);
}

/**
 * Appends an explicit `{#id}` anchor marker to every fenced-code-free heading
 * line, where `id = generateHeadingId(heading)` — so the published anchor
 * exactly matches what the renderer derives from the heading text today.
 */
export function addAnchorMarkers(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CODE_FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = HEADING_LINE_RE.exec(line);
    if (!match) continue;
    const heading = match[2].trim();
    lines[i] = `${match[1]} ${heading} {#${generateHeadingId(heading)}}`;
  }
  return lines.join("\n");
}

/**
 * Builds the frontmatter from the migration metadata. `schema_version` and
 * `type` are pinned; every present schema field is emitted in canonical order,
 * so the file is parseable by `agent/specs/` unchanged.
 */
export function specFrontmatter(metadata: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = { schema_version: 1, type: "project" };
  for (const key of FRONTMATTER_KEY_ORDER) {
    const value = metadata[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    ordered[key] = value;
  }
  return `---\n${dumpYaml(ordered, { lineWidth: -1, noRefs: true }).trimEnd()}\n---`;
}

function applyRewrites(raw: string, rewrites: Record<string, string>): string {
  let out = raw;
  for (const [from, to] of Object.entries(rewrites)) {
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Locates image files referenced by the docs and plans their relocation into
 * `specDir/images/` (so `path.resolve(specDir, imagePath)` keeps working after
 * the docs tree is deleted). Absolute refs are required; refs already under
 * `/images/` are left alone.
 */
export function planImageMoves(
  docs: DiscoveredDoc[],
  context: { docsDir: string; specDir: string }
): { rewrites: Record<string, string>; moves: ImageMove[]; errors: string[] } {
  const { docsDir, specDir } = context;
  const rewrites: Record<string, string> = {};
  const moves: ImageMove[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const byBasename = new Map<string, string>();

  for (const doc of docs) {
    for (const match of doc.raw.matchAll(IMAGE_MD_RE)) {
      const refUrl = match[2];
      if (seen.has(refUrl)) continue;
      seen.add(refUrl);

      if (!refUrl.startsWith("/")) {
        errors.push(
          `${doc.file}: image ref must be absolute (got "${refUrl}"); expected /docs/x.png or an absolute repo path.`
        );
        continue;
      }

      const alreadyRelocated = refUrl.startsWith("/images/");
      if (alreadyRelocated) continue;

      // Candidate physical file under the docs dir (strip `/docs/` if present).
      const relative = refUrl.replace(/^\/docs\//, "").replace(/^\//, "");
      const candidate = path.resolve(docsDir, relative);
      if (!(fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
        errors.push(`Image file not found: ${candidate} (${doc.file}: "${refUrl}")`);
        continue;
      }

      const basename = path.basename(candidate);
      const previous = byBasename.get(basename);
      if (previous && previous !== candidate) {
        errors.push(
          `Image basename collision: "${candidate}" and "${previous}" both map to /images/${basename}.`
        );
        continue;
      }
      byBasename.set(basename, candidate);

      const newRefUrl = `/images/${basename}`;
      rewrites[refUrl] = newRefUrl;
      moves.push({
        refUrl,
        newRefUrl,
        from: candidate,
        to: path.join(specDir, "images", basename),
      });
    }
  }
  return { rewrites, moves, errors };
}

/**
 * Concatenates the docs bodies (in deterministic order) into one canonical body,
 * adding `{#id}` anchors and rewriting any relocated image refs.
 *
 * A doc with no Markdown heading is prefixed with its discovered `heading`
 * (mirroring the old serializer's `heading` option emission).
 */
export function composeSpecBody(
  docs: DiscoveredDoc[],
  rewrites: Record<string, string>
): string {
  const parts: string[] = [];
  for (const doc of docs) {
    let raw = applyRewrites(doc.raw, rewrites).trim();
    if (!hasMarkdownHeading(raw)) {
      raw = `## ${doc.heading.trim()}\n\n${raw}`;
    }
    parts.push(addAnchorMarkers(raw));
  }
  return parts.join("\n\n");
}

/** Assembles the canonical metadata record for the frontmatter. */
export function metadataFromProject(
  existing: ExistingProjectLike | null,
  slug: string
): Record<string, unknown> {
  if (!existing) {
    return { slug, title: slugToTitle(slug) };
  }
  const meta: Record<string, unknown> = {
    slug: existing.slug,
    title: existing.title,
  };
  for (const key of [
    "shortSummary",
    "status",
    "technologies",
    "keyMetrics",
    "githubUrl",
    "demoUrl",
    "demoVideo",
    "featured",
    "displayOrder",
  ] as const) {
    const value = existing[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    meta[key] = value;
  }
  return meta;
}

/**
 * Serializes the docs exactly like the legacy `publish-docs` bridge did: one
 * document at a time, `heading` option set, images resolved via a caller hook.
 * Image refs are rewritten first so the old body and the new body agree on the
 * relocated asset paths.
 */
export function serializeDocsPerFile(
  docs: DiscoveredDoc[],
  rewrites: Record<string, string>,
  resolveImage: (imagePath: string, alt: string) => unknown
): { blocks: ContentBlock[]; errors: string[] } {
  const blocks: ContentBlock[] = [];
  const errors: string[] = [];
  for (const doc of docs) {
    const raw = applyRewrites(doc.raw, rewrites);
    const serialized = serializeMarkdown(raw, {
      heading: doc.heading,
      resolveImage,
    });
    if (serialized.errors.length) {
      errors.push(...serialized.errors.map((error) => `${doc.file}: ${error}`));
      continue;
    }
    blocks.push(...serialized.blocks);
  }
  return { blocks, errors };
}

function blockChildrenText(block: ContentBlock): string {
  const children = block.children as Array<{ text?: string }> | undefined;
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => (typeof child?.text === "string" ? child.text : ""))
    .join("")
    .trim();
}

function stripAnchor(block: ContentBlock): ContentBlock {
  if (!("anchor" in block)) return block;
  const copy = { ...block };
  delete copy.anchor;
  return copy;
}

/**
 * Block-for-block equality between the old per-doc serialization and the new
 * spec-body serialization.
 *
 * Heading anchors are the only intentional difference: the OLD output carries
 * no `anchor` (pre-Phase-3 blocks); the NEW output sets `anchor` to the derived
 * `{#id}`, which must equal `generateHeadingId(heading)` — i.e. exactly the
 * anchor the renderer derives from the old heading text. All other fields
 * (including `_key`s, which are content hashes) must match byte-for-byte.
 */
export function assertSpecEquality(
  oldBlocks: ContentBlock[],
  newBlocks: ContentBlock[]
): string[] {
  const errors: string[] = [];
  if (oldBlocks.length !== newBlocks.length) {
    errors.push(
      `Block count differs: old=${oldBlocks.length}, new=${newBlocks.length}.`
    );
  }
  const limit = Math.max(oldBlocks.length, newBlocks.length);
  for (let i = 0; i < limit; i++) {
    const oldBlock = oldBlocks[i];
    const newBlock = newBlocks[i];
    if (!oldBlock || !newBlock) {
      const missing = `${oldBlock ? "new" : "old"}`;
      errors.push(`Block #${i}: a block is missing in the ${missing} serialization.`);
      continue;
    }
    if (oldBlock._key !== newBlock._key) {
      errors.push(
        `Block #${i} _key differs: "${oldBlock._key}" (old) vs "${newBlock._key}" (new).`
      );
    }
    if (oldBlock._type !== newBlock._type || oldBlock.style !== newBlock.style) {
      errors.push(
        `Block #${i} type/style differs: "${oldBlock._type}/${oldBlock.style}" vs "${newBlock._type}/${newBlock.style}".`
      );
    }

    const oldAnchor = oldBlock.anchor as string | undefined;
    const newAnchor = newBlock.anchor as string | undefined;
    if (newAnchor !== undefined) {
      if (oldAnchor !== undefined) {
        if (oldAnchor !== newAnchor) {
          errors.push(`Block #${i} anchor differs: "${oldAnchor}" vs "${newAnchor}".`);
        }
      } else {
        const expected = generateHeadingId(blockChildrenText(oldBlock));
        if (newAnchor !== expected) {
          errors.push(
            `Block #${i} anchor "${newAnchor}" != generateHeadingId("${expected}") of the old heading.`
          );
        }
      }
    } else if (oldAnchor !== undefined) {
      errors.push(`Block #${i} anchor unexpectedly dropped ("${oldAnchor}").`);
    }

    const oldComparable = stripAnchor(oldBlock);
    const newComparable = stripAnchor(newBlock);
    if (JSON.stringify(oldComparable) !== JSON.stringify(newComparable)) {
      errors.push(
        `Block #${i} (_key=${newBlock._key}) content differs:\n  old: ${JSON.stringify(oldComparable)}\n  new: ${JSON.stringify(newComparable)}`
      );
    }
  }
  return errors;
}

/**
 * Full deterministic migration pipeline: docs → body + frontmatter → spec, and
 * the equality gate. Pure functions only; the bridge performs the filesystem
 * side effects (write spec, relocate images, delete docs).
 */
export function generateProjectSpec(
  input: GenerateProjectSpecInput
): GenerateProjectSpecResult {
  const docs = discoverDocs(input.docsDir, { filenameOrder: FILENAME_ORDER });
  if (!docs.length) {
    throw new Error(`No Markdown documents found in ${input.docsDir}`);
  }

  const { rewrites, moves, errors: moveErrors } = planImageMoves(docs, {
    docsDir: input.docsDir,
    specDir: input.specDir,
  });

  const metadata = metadataFromProject(input.existing, input.slug);
  const frontmatter = specFrontmatter(metadata);
  const body = composeSpecBody(docs, rewrites);
  const spec = `${frontmatter}\n\n${body.trim()}\n`;

  const resolveImage =
    input.resolveImage ?? ((imagePath: string) => ({ _ref: imagePath }));

  const old = serializeDocsPerFile(docs, rewrites, resolveImage);
  if (old.errors.length) {
    throw new Error(
      `Serializer errors in old docs for "${input.slug}":\n  - ${old.errors.join("\n  - ")}`
    );
  }
  const newSerialized = serializeMarkdown(body, { resolveImage });
  if (newSerialized.errors.length) {
    throw new Error(
      `Serializer errors in spec body for "${input.slug}":\n  - ${newSerialized.errors.join("\n  - ")}`
    );
  }

  const equalityErrors = assertSpecEquality(old.blocks, newSerialized.blocks);

  return {
    spec,
    frontmatter,
    body,
    metadata,
    docs,
    rewrites,
    moves,
    oldBlocks: old.blocks,
    newBlocks: newSerialized.blocks,
    equalityErrors: [...moveErrors, ...equalityErrors],
  };
}