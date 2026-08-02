import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { load as loadYaml } from "js-yaml";

/**
 * Deterministic discovery of Markdown documentation documents inside a
 * project's `docs/` directory.
 *
 * Each `.md` file is an *engineering document* (never a schema field). They are
 * ordered by an explicit `order` front-matter field, falling back to a stable
 * filename sort. Size caps protect the model's context window and the Portable
 * Text document size. Malformed front-matter is rejected loudly.
 */

export type DiscoveredDoc = {
  /** Absolute path to the file. */
  path: string;
  /** Path relative to the scanned docs dir. */
  file: string;
  /** Order from front-matter, or +Infinity to sort after ordered docs. */
  order: number;
  /** Document title (front-matter `title` → first heading → filename). */
  heading: string;
  /** Document body (front-matter stripped). */
  raw: string;
  /** SHA-256 of the body for stable-key framing / change detection. */
  sha: string;
  /** Raw front-matter (with delimiters), or empty string. */
  frontMatter: string;
};

export type DiscoverDocsOptions = {
  /** Hard per-file cap in characters. Default 30000. */
  maxFileChars?: number;
  /** Hard per-directory cap in characters (sum of all raw bodies). Default 200000. */
  maxDirChars?: number;
  /**
   * Ordering. Fixed order maps a canonical doc filename to an order/sequence
   * (committed docs use this to pin the canonical narrative order). Optional.
   */
  filenameOrder?: Record<string, number>;
};

const DEFAULT_MAX_FILE_CHARS = 30000;
const DEFAULT_MAX_DIR_CHARS = 200000;

export class DocDiscoveryError extends Error {}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function discoverDocs(
  dir: string,
  options: DiscoverDocsOptions = {}
): DiscoveredDoc[] {
  const maxFileChars = options.maxFileChars ?? DEFAULT_MAX_FILE_CHARS;
  const maxDirChars = options.maxDirChars ?? DEFAULT_MAX_DIR_CHARS;

  const files = walkMarkdownFiles(dir).sort((a, b) => a.localeCompare(b));

  const docs: DiscoveredDoc[] = [];
  let totalChars = 0;

  for (const file of files) {
    if (path.basename(file).toLowerCase() === "readme.md") {
      continue;
    }
    if (path.basename(file).startsWith(".")) {
      continue;
    }

    const absolute = path.resolve(dir, file);
    const text = fs.readFileSync(absolute, "utf-8");

    const { frontMatter, raw } = stripFrontMatter(text);

    if (raw.length > maxFileChars) {
      throw new DocDiscoveryError(
        `Document "${file}" is ${raw.length} chars, exceeds maxFileChars=${maxFileChars}.`
      );
    }
    totalChars += raw.length;
    if (totalChars > maxDirChars) {
      throw new DocDiscoveryError(
        `docs directory exceeds maxDirChars=${maxDirChars}.`
      );
    }

    const meta = parseFrontMatter(frontMatter, file);
    const explicitOrder = coerceOrder(meta.order);
    const order =
      explicitOrder ?? options.filenameOrder?.[file] ?? Number.MAX_SAFE_INTEGER;
    const heading =
      typeof meta.title === "string" && meta.title.trim()
        ? meta.title.trim()
        : firstHeading(raw) ?? filenameToHeading(file);

    docs.push({
      path: absolute,
      file,
      order,
      heading,
      raw,
      sha: sha256(raw),
      frontMatter,
    });
  }

  docs.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.file.localeCompare(b.file);
  });

  return docs;
}

function walkMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new DocDiscoveryError(`Docs directory not found or not a directory: ${dir}`);
  }

  const results: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
        results.push(path.relative(dir, full));
      }
    }
  };
  walk(dir);
  return results;
}

export function stripFrontMatter(
  text: string
): { frontMatter: string; raw: string } {
  const match = FRONT_MATTER_RE.exec(text);
  if (!match) {
    return { frontMatter: "", raw: text.trim() };
  }
  return {
    frontMatter: `---\n${match[1]}\n---`,
    raw: text.slice(match[0].length).trim(),
  };
}

function parseFrontMatter(
  frontMatter: string,
  source: string
): Record<string, unknown> {
  if (!frontMatter) {
    return {};
  }
  const body = frontMatter.replace(/^---\r?\n/, "").replace(/\r?\n---$/, "");
  try {
    const parsed = loadYaml(body);
    if (parsed === null || typeof parsed === "string" || Array.isArray(parsed)) {
      throw new Error("front-matter must be a YAML mapping");
    }
    if (typeof parsed !== "object") {
      throw new Error("front-matter must be a YAML mapping");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new DocDiscoveryError(
      `Malformed front-matter in "${source}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/m;

function firstHeading(text: string): string | null {
  const match = HEADING_RE.exec(text);
  return match ? match[2].trim() : null;
}

function filenameToHeading(file: string): string {
  const stem = path.basename(file, path.extname(file));
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function coerceOrder(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}