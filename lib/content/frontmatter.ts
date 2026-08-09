/**
 * Frontmatter strip for the canonical `project-spec.md` format.
 *
 * The delimiter regex is the single authority for frontmatter stripping. The
 * Python agent-side parser (`agent/specs/frontmatter.py`) keeps a parity copy,
 * so the spec pipeline and the TS content pipeline agree on where the body
 * begins.
 */

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

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