import { createHash } from "node:crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type {
  Content,
  Emphasis,
  Image,
  Link,
  List,
  Paragraph,
  Root,
  Strong,
  Text,
  Table,
} from "mdast";

/**
 * Deterministic Markdown → Portable Text serializer.
 *
 * Maps a Markdown document into the Portable Text block palette used by
 * `project.content` (and doc pages): headings, prose, lists, code marks,
 * `documentationCodeBlock`, `documentationMermaidDiagram`,
 * `documentationCallout`, `documentationTable`, `documentationImage`,
 * `faqItem`, and `challengeCard`.
 *
 * The serializer is **schema-free**: it needs no knowledge of "which sections
 * exist". Any document/heading renders to blocks, so new storytelling documents
 * are free.
 *
 * Stable `_key`s are derived from content hashes (sanitized for Sanity's
 * charset) so re-runs are idempotent and diffs are possible.
 */

export type ChildNode = {
  _type: "span";
  _key?: string;
  text?: string;
  marks?: string[];
  children?: ChildNode[];
};

export type ContentBlock = {
  _type: string;
  _key?: string;
  [key: string]: unknown;
};

export type SerializeOptions = {
  /** Document title. Emitted as an h2 when the Markdown body has no heading. */
  heading?: string;
  /**
   * Resolves a `![alt](path)` reference into the value stored under
   * `documentationImage.image`. The publish-docs bridge supplies this to upload
   * the file; tests supply a placeholder.
   */
  resolveImage?: (path: string, alt: string) => unknown;
  /** Hard input cap in characters. Default 60000. */
  maxChars?: number;
};

export type SerializeResult = { blocks: ContentBlock[]; errors: string[] };

const DEFAULT_MAX_CHARS = 60000;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Stable, Sanity-charset-safe `_key` from a content seed. */
export function stableKey(seed: string, prefix = "k"): string {
  return `${prefix}_${digest(seed).slice(0, 16)}`;
}

// ── Structural validation ─────────────────────────────────

export function validateMarkdownStruct(raw: string): string[] {
  const errors: string[] = [];
  let fenceOpen = false;
  for (const line of raw.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenceOpen = !fenceOpen;
    }
  }
  if (fenceOpen) {
    errors.push("Unbalanced code fence: a ``` (or ~~~) block is not closed.");
  }

  const imageRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imageRe.exec(raw)) !== null) {
    const imgPath = imgMatch[2];
    if (!imgPath.startsWith("/")) {
      errors.push(`Image path must be absolute (got ${imgPath}); use a path relative to repo root.`);
    }
  }

  return errors;
}

// ── Serializer ─────────────────────────────────────────────

export function serializeMarkdown(
  raw: string,
  options: SerializeOptions = {}
): SerializeResult {
  const errors: string[] = [];

  if (raw.length > (options.maxChars ?? DEFAULT_MAX_CHARS)) {
    return {
      blocks: [],
      errors: [
        `Markdown is ${raw.length} chars, exceeds maxChars=${options.maxChars ?? DEFAULT_MAX_CHARS}.`,
      ],
    };
  }

  const structural = validateMarkdownStruct(raw);
  if (structural.length) {
    return { blocks: [], errors: structural };
  }

  let tree: Root;
  try {
    tree = unified().use(remarkParse).use(remarkGfm).parse(raw);
  } catch (error) {
    return {
      blocks: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  const ctx: Context = {
    blocks: [],
    errors,
    resolveImage: options.resolveImage,
    pendingChallenge: null,
    pendingQuestion: null,
  };

  const topDepth = minHeadingDepth(tree);

  if (!hasMarkdownHeading(tree) && options.heading?.trim()) {
    ctx.blocks.push({
      _type: "block",
      _key: stableKey(`h2:${options.heading.trim()}`),
      style: "h2",
      children: [{ _type: "span", text: options.heading.trim() }],
    });
  }

  for (const node of tree.children) {
    translate(node, ctx, topDepth);
  }
  flushChallenge(ctx);
  flushFaq(ctx);

  return { blocks: ctx.blocks, errors: ctx.errors };
}

interface Context {
  blocks: ContentBlock[];
  errors: string[];
  resolveImage?: SerializeOptions["resolveImage"];
  pendingChallenge: { problem: string; solution?: string; outcome?: string } | null;
  pendingQuestion: string | null;
}

// ── Top-level dispatch ─────────────────────────────────────

function translate(node: Content, ctx: Context, topDepth: number | null): void {
  switch (node.type) {
    case "heading": {
      flushGroups(ctx);
      ctx.blocks.push(headingBlock(node, topDepth));
      return;
    }
    case "code": {
      flushGroups(ctx);
      ctx.blocks.push(codeBlock(node));
      return;
    }
    case "table": {
      flushGroups(ctx);
      ctx.blocks.push(tableBlock(node));
      return;
    }
    case "blockquote": {
      flushGroups(ctx);
      ctx.blocks.push(calloutBlock(node));
      return;
    }
    case "image": {
      flushGroups(ctx);
      const block = imageBlock(node, ctx);
      if (block) ctx.blocks.push(block);
      return;
    }
    case "list": {
      flushGroups(ctx);
      listBlocks(node, ctx);
      return;
    }
    case "paragraph": {
      translateParagraph(node, ctx);
      return;
    }
    default:
      return;
  }
}

function translateParagraph(node: Paragraph, ctx: Context): void {
  if (singleImage(node)) {
    flushGroups(ctx);
    const block = imageBlock(node.children[0] as Image, ctx);
    if (block) ctx.blocks.push(block);
    return;
  }

  const segments = sectionSegments(node);

  if (segments) {
    for (const segment of segments) {
      handleSectionSegment(segment.label, segment.text.trim(), ctx);
    }
    return;
  }

  flushGroups(ctx);
  ctx.blocks.push(paragraphBlock(node));
}

function handleSectionSegment(label: string, text: string, ctx: Context): void {
  if (label === "problem") {
    if (ctx.pendingChallenge?.problem) flushChallenge(ctx);
    ctx.pendingChallenge = { problem: text, solution: "", outcome: "" };
    return;
  }
  if (label === "solution") {
    if (!ctx.pendingChallenge) ctx.pendingChallenge = { problem: "", solution: "", outcome: "" };
    ctx.pendingChallenge.solution = text;
    return;
  }
  if (label === "outcome") {
    if (!ctx.pendingChallenge) ctx.pendingChallenge = { problem: "", solution: "", outcome: "" };
    ctx.pendingChallenge.outcome = text;
    flushChallenge(ctx);
    return;
  }
  if (label === "q" || label === "a") {
    flushChallenge(ctx);
    if (label === "q") {
      ctx.pendingQuestion = text;
    } else {
      if (ctx.pendingQuestion !== null) {
        ctx.blocks.push({
          _type: "faqItem",
          _key: stableKey(`faq:${ctx.pendingQuestion}`),
          question: ctx.pendingQuestion,
          answer: text,
        });
        ctx.pendingQuestion = null;
      } else {
        ctx.blocks.push({ _type: "faqItem", _key: stableKey(`faqA:${text}`), question: "", answer: text });
      }
    }
  }
}

// ── Block builders ─────────────────────────────────────────

function headingBlock(node: Content & { depth: number }, topDepth: number | null): ContentBlock {
  const style = headingStyle(node.depth, topDepth);
  const text = mdastText(node).trim();
  return {
    _type: "block",
    _key: stableKey(`h${node.depth}:${text}`),
    style,
    children: inlineChildren((node as Content & { children: Content[] }).children),
  };
}

function codeBlock(node: Content & { type: "code" }): ContentBlock {
  const lang = node.lang || "";
  const value = node.value || "";
  if (lang === "mermaid") {
    return { _type: "documentationMermaidDiagram", _key: stableKey(`mermaid:${value.slice(0, 64)}`), chart: value };
  }
  return {
    _type: "documentationCodeBlock",
    _key: stableKey(`code:${lang}:${value.slice(0, 64)}`),
    code: value,
    language: lang || undefined,
  };
}

function tableBlock(node: Table): ContentBlock {
  const headers = node.children[0]?.children.map((c) => mdastText(c)) || [];
  const rows = node.children.slice(1).map((row) => ({ cells: row.children.map((cell) => mdastText(cell)) }));
  return { _type: "documentationTable", _key: stableKey(`table:${headers.join("|")}`), headers, rows };
}

function calloutBlock(node: Content & { type: "blockquote" }): ContentBlock {
  const source = node.children.map((c) => mdastText(c)).join("\n");
  const variant = calloutVariant(source);
  const { title, body } = splitCallout(source);
  return {
    _type: "documentationCallout",
    _key: stableKey(`callout:${variant}:${body.slice(0, 64)}`),
    title: title || undefined,
    body: body || source,
    variant,
  };
}

function imageBlock(node: Image, ctx: Context): ContentBlock | null {
  const alt = node.alt || "";
  const path = node.url || "";
  if (!alt) {
    ctx.errors.push("documentationImage requires alt text (alt is required by the schema).");
  }
  return {
    _type: "documentationImage",
    _key: stableKey(`img:${alt}:${path}`),
    image: ctx.resolveImage?.(path, alt),
    alt,
  };
}

function paragraphBlock(node: Paragraph): ContentBlock {
  return {
    _type: "block",
    _key: stableKey(`p:${mdastText(node).slice(0, 80)}`),
    style: "normal",
    children: inlineChildren(node.children),
  };
}

function listBlocks(node: List, ctx: Context): void {
  for (const item of node.children) {
    ctx.blocks.push({
      _type: "block",
      _key: stableKey(`li:${mdastText(item).slice(0, 80)}`),
      style: "normal",
      listItem: node.ordered ? "number" : "bullet",
      level: 1,
      children: inlineChildren(item.children),
    });
  }
}

// ── Inline children ─────────────────────────────────────────

function inlineChildren(nodes: Content[]): ChildNode[] {
  const out: ChildNode[] = [];
  for (const node of nodes) convertInline(node, out, []);
  return out;
}

function convertInline(node: Content, out: ChildNode[], marks: string[]): void {
  switch (node.type) {
    case "text":
      pushSpan(out, (node as Text).value, marks);
      return;
    case "strong":
      for (const c of (node as Strong).children) convertInline(c, out, [...marks, "strong"]);
      return;
    case "emphasis":
      for (const c of (node as Emphasis).children) convertInline(c, out, [...marks, "em"]);
      return;
    case "inlineCode":
      out.push({ _type: "span", text: node.value, marks: [...marks, "code"] });
      return;
    case "link":
      for (const c of (node as Link).children) convertInline(c, out, marks);
      return;
    case "delete":
      for (const c of (node as Content & { children: Content[] }).children) convertInline(c, out, marks);
      return;
    case "break":
      out.push({ _type: "span", text: "\n" });
      return;
    default:
      return;
  }
}

function pushSpan(out: ChildNode[], text: string, marks: string[]): void {
  if (!text.length) return;
  out.push({ _type: "span", text, marks: marks.length ? marks.slice() : undefined });
}

// ── helpers ─────────────────────────────────────────────────

function mdastText(node: Content, acc: string[] = []): string {
  if (!node) return acc.join("");
  const n = node as Content & { value?: string; children?: Content[] };
  if (typeof n.value === "string") acc.push(n.value);
  if (Array.isArray(n.children)) {
    for (const child of n.children) mdastText(child, acc);
  }
  return acc.join("");
}

function singleImage(node: Paragraph): boolean {
  return node.children.length === 1 && node.children[0].type === "image";
}

/**
 * Splits a paragraph into consecutive labeled segments (`**Problem:** …`,
 * `**Solution:** …`, `**Outcome:** …`, `**Q:** …`, `**A:** …`). Returns `null`
 * when the paragraph is ordinary prose (no leading known strong label).
 *
 * This handles labels separated only by soft line breaks (no blank line), which
 * remark parses as a single paragraph node.
 */
function sectionSegments(node: Paragraph): Array<{ label: string; text: string }> | null {
  const segments: Array<{ label: string; text: string }> = [];
  let current: { label: string; text: string } | null = null;

  for (const child of node.children) {
    if (child.type === "strong") {
      const strongText = mdastText(child).trim().replace(/[:\s]+$/g, "").toLowerCase();
      if (["problem", "solution", "outcome", "q", "a"].includes(strongText)) {
        if (current) segments.push(current);
        current = { label: strongText, text: "" };
        continue;
      }
      return null;
    }
    if (current) {
      current.text += `${mdastText(child)} `;
    } else {
      return null;
    }
  }

  if (current) segments.push(current);
  return segments.length ? segments : null;
}

function hasMarkdownHeading(tree: Root): boolean {
  return tree.children.some((n) => n.type === "heading");
}

function minHeadingDepth(tree: Root): number | null {
  const depths = tree.children.filter((n) => n.type === "heading").map((n) => (n as { depth: number }).depth);
  return depths.length ? Math.min(...depths) : null;
}

function headingStyle(depth: number, topDepth: number | null): string {
  const base = topDepth ?? 2;
  const level = Math.min(4, Math.max(2, 2 + (depth - base)));
  return `h${level}`;
}

function calloutVariant(source: string): string {
  const lower = source.toLowerCase();
  if (/limitations?\b/.test(lower)) return "limitation";
  if (/\blesson/.test(lower)) return "lesson";
  if (/future|roadmap|upcoming/.test(lower)) return "future";
  if (/warning|caution/.test(lower)) return "warning";
  if (/success|complete/.test(lower)) return "success";
  return "info";
}

function splitCallout(source: string): { title: string | null; body: string } {
  const label = source.match(/^\*\*([^*]+)\*\*?\s*[:：]?([\s\S]*)$/);
  if (label) {
    return { title: label[1].trim() || null, body: label[2].trim() };
  }
  return { title: null, body: source.trim() };
}

function flushGroups(ctx: Context): void {
  flushChallenge(ctx);
  flushFaq(ctx);
}

function flushChallenge(ctx: Context): void {
  if (!ctx.pendingChallenge) return;
  ctx.blocks.push({
    _type: "challengeCard",
    _key: stableKey(`challenge:${ctx.pendingChallenge.problem.slice(0, 80)}`),
    problem: ctx.pendingChallenge.problem,
    solution: ctx.pendingChallenge.solution || "",
    outcome: ctx.pendingChallenge.outcome || "",
  });
  ctx.pendingChallenge = null;
}

function flushFaq(ctx: Context): void {
  if (ctx.pendingQuestion === null) return;
  ctx.blocks.push({
    _type: "faqItem",
    _key: stableKey(`faq:${ctx.pendingQuestion}`),
    question: ctx.pendingQuestion,
    answer: "",
  });
  ctx.pendingQuestion = null;
}