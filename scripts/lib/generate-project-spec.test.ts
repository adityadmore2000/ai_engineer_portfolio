import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  generateProjectSpec,
  assertSpecEquality,
  addAnchorMarkers,
} from "./generate-project-spec";
import { serializeMarkdown } from "../../lib/content/markdown-to-pt";
import type { ContentBlock } from "../../lib/content/markdown-to-pt";
import { generateHeadingId } from "../../lib/content/headings";

/**
 * Phase 6 verification — converting docs trees to canonical specs, no Sanity.
 *
 * The scratch project's `docs/` tree is mirrored + an image asset is added in
 * a temp dir (so the committed fixtures stay pristine), then the canonical spec
 * is generated and verified:
 *   1. the spec body serializes to blocks *identical* to the old per-doc form
 *   2. derived `{#id}` anchors equal the published `generateHeadingId` anchors
 *   3. regeneration is idempotent
 *   4. a divergent body fails the equality gate loudly (docs untouched)
 */

const FIXTURE_DOCS = path.resolve(__dirname, "../fixtures/project-alpha/docs");

let tempProject: string;
let docsDir: string;

beforeAll(() => {
  tempProject = fs.mkdtempSync(path.join(os.tmpdir(), "project-alpha-"));
  docsDir = path.join(tempProject, "docs");
  fs.cpSync(FIXTURE_DOCS, docsDir, { recursive: true });
  // The relocated image asset must physically exist for the move plan.
  fs.writeFileSync(path.join(docsDir, "architecture-diagram.png"), "png-data");
});

afterAll(() => {
  fs.rmSync(tempProject, { recursive: true, force: true });
});

const placeholderResolver = (imagePath: string) => ({ _ref: imagePath });

function generate() {
  return generateProjectSpec({
    slug: "project-alpha",
    docsDir,
    specDir: tempProject,
    existing: null,
    resolveImage: placeholderResolver,
  });
}

function blockText(block: ContentBlock): string {
  const children = block.children as Array<{ text?: string }> | undefined;
  return (children ?? []).map((c) => c.text ?? "").join("").trim();
}

describe("generateProjectSpec (Phase 6 migration)", () => {
  it("spec body serializes to blocks identical to the old per-doc serialization", () => {
    const result = generate();

    expect(result.equalityErrors).toEqual([]);
    expect(result.oldBlocks.length).toBe(result.newBlocks.length);

    // Stable content-hash _keys must match block-for-block.
    expect(result.newBlocks.map((b) => b._key)).toEqual(
      result.oldBlocks.map((b) => b._key)
    );

    // Heading anchors are the ONLY intentional difference: the old form has
    // none; the new form sets the derived anchor on the same heading text.
    const oldHeading = result.oldBlocks.find(
      (b) => b.style === "h2" && blockText(b) === "System Architecture"
    )!;
    const idx = result.oldBlocks.indexOf(oldHeading);
    const newHeading = result.newBlocks[idx];
    expect(newHeading).toMatchObject({
      anchor: "system-architecture",
      style: "h2",
    });
    expect(blockText(newHeading)).toBe("System Architecture");
  });

  it("emits canonical frontmatter parseable by the spec parser", () => {
    const result = generate();
    const meta = loadYaml(
      result.frontmatter.replace(/^---\r?\n/, "").replace(/\r?\n---$/, "")
    ) as Record<string, unknown>;

    expect(meta.schema_version).toBe(1);
    expect(meta.type).toBe("project");
    expect(meta.slug).toBe("project-alpha");
    expect(meta.title).toBe("Project Alpha");
    expect(result.spec.startsWith("---")).toBe(true);
  });

  it("adds {#id} markers derived via generateHeadingId (published anchors)", () => {
    const result = generate();

    for (const hit of result.body.matchAll(
      /^\s*#{1,6}\s+(.+?)\s+\{#([a-z0-9][a-z0-9-]*[a-z0-9])\}\s*$/gm
    )) {
      expect(hit[2]).toBe(generateHeadingId(hit[1]));
    }
    // The anchor the site rendered for this heading before migration.
    expect(result.body).toContain("## System Architecture {#system-architecture}");
  });

  it("relocates image assets to images/ and rewrites the refs", () => {
    const result = generate();

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({
      refUrl: "/architecture-diagram.png",
      newRefUrl: "/images/architecture-diagram.png",
      to: path.join(tempProject, "images", "architecture-diagram.png"),
    });
    expect(result.body).toContain("/images/architecture-diagram.png");
    expect(result.body).not.toContain("](/architecture-diagram.png)");
  });

  it("is idempotent: regenerating produces the identical spec", () => {
    const first = generate();
    const second = generate();
    expect(second.spec).toBe(first.spec);
    expect(second.body).toBe(first.body);
  });

  it("fails loudly on a divergent body and leaves docs untouched", () => {
    const result = generate();

    // Simulate an author editing a heading (text + anchor diverge).
    const mutated = result.body.replace(
      "## System Architecture {#system-architecture}",
      "## System Architecture v2 {#system-architecture-2}"
    );
    const serialized = serializeMarkdown(mutated, {
      resolveImage: placeholderResolver,
    });

    const errors = assertSpecEquality(result.oldBlocks, serialized.blocks);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/key differs|anchor|content differs/i);

    // The migration never deletes the docs tree on a failed gate.
    expect(fs.readdirSync(docsDir)).toContain("architecture.md");
  });

  it("synthesizes a heading for a doc without one (old `heading` option)", () => {
    const result = generate();

    // `notes.md` has no body heading; the old serializer emitted an h2 from its
    // filename-derived title. The new body must reproduce the same heading with
    // the identical derived anchor.
    const notes = result.newBlocks.find((b) => b.style === "h2" && blockText(b) === "Notes");
    expect(notes).toBeDefined();
    expect(notes).toMatchObject({ anchor: "notes" });
  });
});

describe("addAnchorMarkers", () => {
  it("skips heading-like lines inside code fences", () => {
    const md = "```markdown\n# not a heading\n```\n\n## Real\n";
    const out = addAnchorMarkers(md);
    expect(out).toContain("# not a heading");
    expect(out).toContain("## Real {#real}");
  });

  it("leaves non-heading prose unchanged", () => {
    const md = "plain paragraph\ntext on next line";
    expect(addAnchorMarkers(md)).toBe(md);
  });
});