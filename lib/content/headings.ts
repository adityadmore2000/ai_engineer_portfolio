/**
 * Canonical heading / anchor id generation — the single source of truth for
 * slugifying heading text into stable anchor ids (`#<heading-slug>`).
 *
 * Every consumer (doc-page TOC, chunker, migrator, project-page renderer) must
 * call `generateHeadingId()` rather than implementing its own slugification, so
 * chat citations and deep links always agree on the same anchor scheme.
 *
 * Two modes:
 * - **bare mode** (default): produces `why-i-built-it` — used by the project
 *   page renderer, the legacy-content migration, and the chunker so that
 *   existing deep-link citations (`/projects/<slug>#why-i-built-it`) keep
 *   working.
 * - **keyed mode** (`options.key`): appends a `-<8-char key>` suffix
 *   (e.g. `why-i-built-it-abc12345`) — preserves the existing doc-page TOC
 *   behavior that disambiguates duplicate headings by block `_key`.
 *
 * Uniqueness is enforced via an optional `used` map so duplicate headings
 * receive stable numeric suffixes (`-2`, `-3`, …), matching the previous
 * doc-page `createToc` behavior.
 */
export function generateHeadingId(
  title: string,
  options: { key?: string; used?: Map<string, number> } = {}
): string {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";

  const preferred = options.key ? `${base}-${options.key.slice(0, 8)}` : base;

  if (!options.used) {
    return preferred;
  }

  const count = options.used.get(preferred) || 0;
  const id = count ? `${preferred}-${count + 1}` : preferred;
  options.used.set(preferred, count + 1);
  return id;
}