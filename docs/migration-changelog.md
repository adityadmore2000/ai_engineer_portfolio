# Migration Changelog: Metadata / Narrative Separation

This changelog records every completed phase of the metadata / narrative
separation migration, sequenced per `docs/implementation-plan.md`. Each phase
maps to one (or more) reviewable commits.

Target architecture: Markdown authored in the repository (`projects/<slug>/docs/*.md`)
is the source of truth; the Publishing Agent deterministically serializes it to
Portable Text stored on `project.content`; the renderer and retrieval read
`content` (heading-based sections) instead of ~18 flat narrative schema fields.

---

## Project metadata

- **Source of truth:** `docs/implementation-plan.md` (task map T1–T16),
  `docs/project-content-architecture.md`, `docs/migration-plan.md`.
- **Validation per phase:** `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run build`.

---

## Phase 0 — Foundation & pure refactors (T1, T2, T3) — DONE

**Objective:** introduce the test runner and the shared abstractions every later
phase consumes. No behavior change.

**Branch/commit:** feature branch work; `6fd7b1f feat(content): add shared
heading/PT utils, upload module, test runner`.

### Files added
- `vitest.config.ts` — vitest config (node env, `@` alias).
- `lib/content/headings.ts` — canonical `generateHeadingId()` (bare + keyed
  modes; duplicate disambiguation via `used` map). Single source of truth for
  anchor ids.
- `lib/content/portable-text.ts` — required shared abstraction: PT→text flatten
  and heading-based section splitter (`splitSectionsByHeading`).
- `scripts/lib/upload.ts` — shared exported `uploadImage` + `ImageRef` type.
- `lib/content/headings.test.ts` — heading-id cases (bare/keyed/dedup).

### Files modified
- `package.json` — added `test` script + `vitest` devDep.
- `lib/indexing/chunkers.ts` — re-uses `generateHeadingId()` for anchors
  (dropped inline slug).
- `lib/project-docs-source.ts` — re-uses shared `generateHeadingId()`
  (dropped private `slugify`).
- `scripts/publish-tool.ts` — re-imports shared `uploadImage` (dropped private copy).

### Decisions / notes
- Keyed mode (`-<8-char key>`) preserved for doc-page TOC; bare mode
  implemented for project-page / migration / chunker use (Risk R2).
- `@` path alias resolves to repo root throughout.

### Verification
- `npm test` (28 tests), typecheck, lint (only pre-existing warnings in
  unrelated `lib/agent`, `lib/observability`), build green.

---

## Phase 1 — Deterministic content tooling (T4, T5) — DONE

**Objective:** deterministic Markdown-document discovery + Markdown→Portable
Text serializer (both schema-free). Additive.

**Branch commit:** `cb6d50b feat(content): add docs discovery +
Markdown->PortableText serializer`.

### Files added
- `lib/content/discover-docs.ts` — recursive `.md` scan, `order` front-matter
  → filename fallback, per-file/per-dir size caps, loud malformed-front-matter
  errors, `[{ file, order, heading, raw, sha }]`.
- `lib/content/markdown-to-pt.ts` — md→PT serializer mapping h2/h3/h4, prose,
  lists, code marks, `documentationCodeBlock`, `documentationMermaidDiagram`,
  `documentationCallout` (keyword variants), `documentationTable`,
  `documentationImage`, `faqItem`, `challengeCard`; structural validation
  (balanced fences, absolute image paths) + stable content-hash `_key`s.
- `lib/content/discover-docs.test.ts`, `lib/content/markdown-to-pt.test.ts`.

### Files modified
- `package.json` — devDeps for `unified`, `remark-parse`, `remark-gfm`,
  `mdast-util-to-string`, `unist-util-visit`, `js-yaml`, `@types/js-yaml`.

### Decisions
- Serializer is schema-free and deterministic (Decision 2: `unified` +
  `remark-parse`).
- Portable Text is a derived representation; Markdown is the authoring source.
- `documentationImage.alt` is always required by the schema, so the serializer
  emits alt text / errors (Risk R5).

### Verification
- `npm test` (28), typecheck, lint, build green.

---

## Phase 2 — Schema `content` + read surfaces (T6, part of T7) — DONE

**Files:** `sanity/schemaTypes/project.ts`, `documentationBlocks.ts`,
`schemaTypes/index.ts`, `projectDocumentationPage.ts`, `sanity/types.ts`,
`scripts/publish-tool.ts`, `sanity/queries.ts`.

### Gains
- `documentationBlocks.ts` — added `faqItem`, `challengeCard` object types
  (thin wrappers over legacy shapes) + shared `portableTextBlockMember`,
  `projectContentBlockOf`, `documentationPageBlockOf`.
- `project.ts` — added `content: array` of (shared block config +
  `...documentationBlockTypes` + `faqItem` + `challengeCard`), `Rule.min(1)`,
  described as published representation (do not edit).
- `index.ts` — registers `faqItem`/`challengeCard`.
- `sanity/types.ts` — `ProjectDetail.content?: PortableTextBlock[]`.
- `sanity/queries.ts` — `projectBySlugQuery` selects `content`.
- `publish-tool.ts` — `ProjectReadOutput.content`, `readProjectQuery`
  selects `content`, `BLOCK_KEYS` excludes `content` from generic metadata path.

### Decisions
- `content` is excluded from the metadata create/update path (Risk R7).

---

## Phase 3 — Read surfaces select `content` (T7, remainder) — DONE

Finishes the read-surface work (the query/type/bridge `content` selection from
Phase 2 already landed). Remaining items made fallbacks metadata-only.

### Files modified
- `sanity/fallbackContent.ts` — fallback projects are now **metadata-only**
  (Decision 3): dropped all legacy narrative fields (`whyIBuiltIt`,
  `theProblem`, `interestingChallenges`, `results`, etc.), keeping only
  metadata (`title`, `slug`, `shortSummary`, `status`, `technologies`,
  `keyMetrics`, `featured`, `displayOrder`).
- `lib/indexing/adapters.ts` — `fallbackToSanityProject` maps only metadata;
  legacy narrative fields pinned to `null` so the shared `SanityProject` shape
  still compiles (removed fully in Phase 8 / T15).

### Decisions / notes
- Risk R6 accepted: the no-Sanity dev experience loses narrative for fallback
  projects (the metadata hero renders alone). This matches migration-plan §3.4
  and the approved Decision 3. The real dataset (Sanity `content`) carries the
  actual narrative.
- `content` remains optional/absent for fallback projects; the document is
  metadata-only.

### Verification
- `npm test` (28), typecheck, lint, build green.

---

## Phase 4 — `publish-docs` bridge (T8) — DONE

**Objective:** a bridge that discovers a project's `docs/` directory,
deterministically serializes each Markdown document to Portable Text, uploads
images, and patches `project.content` as a replace with stable keys — without
touching metadata.

### Files added
- `scripts/publish-docs.ts` — CLI bridge:
  - `discoverDocs(docsDir, { filenameOrder })` — canonical doc order via a
    filename map (overview → … → faq), falling back to front-matter `order`,
    then alphabetical.
  - `serializeMarkdown(raw, { heading, resolveImage })` — per-document PT
    serialization; `resolveImage` uploads absolute image paths via the shared
    `uploadImage` (setting alt) and enforces absolute-path rules.
  - `client.patch(id).set({ content })` — replace with stable keys; metadata
    untouched.
  - `--check` flag performs a no-write serialization pass and reports block
    counts + serialization errors.

### Decisions / notes
- Image resolution happens inside serialization via the shared `resolveImage`
  callback (R5: alt always set when supplied).
- Fractional doc ordering: `filenameOrder` overrides `order` front-matter for
  the canonical sequence (migration-plan §3.2 / §3.8). New documents default to
  alphabetical order.
- Errors abort before any write — content is never partially published.

### Verification
- typecheck clean, lint clean (beyond the 3 pre-existing unrelated warnings),
  tests (28) pass. (Runtime round-trip against the local dataset is exercised
  in T10/T14.)

---

## Phase 5 — Agent `publish_docs` tool + prompt cleanup (T9) — DONE

**Objective:** expose `publish_docs` to the Publishing Agent, explicitly exclude
`content` from the metadata writable set, and trim stale field lists from the
agent's tool args + `SYSTEM_PROMPT` (Risk R8 minimal trim).

### Files modified (agent/publish_agent.py)
- `_writable_field_types` — excluded `content` alongside `detailedContent` so
  the generic metadata mapping path can never clobber the derived narrative
  (Risk R7).
- `@tool publish_docs(slug, docs_dir)` — new tool that shells out to
  `scripts/publish-docs.ts`; clear docstring distinguishing it from metadata
  mutations.
- Tool registration list — added `publish_docs`.
- `SYSTEM_PROMPT` — added a narrative-publishing tools section, an
  INTENT → OPERATION mapping block for `publish_docs`, and rewrote the
  "Schema Fields" section to be metadata-only with a note pointing narrative to
  `publish_docs`.
- `create_project` / `update_project` tool-arg field lists — trimmed to metadata
  only (dropped `problemStatement`/`approach`/`results`/`limitations`/
  `futureImprovements`).

### Decisions
- Minimal prompt trim per Risk R8 — schema-driven prompt regeneration is left
  as a documented follow-up to keep this PR small.
- `publish_docs` is explicitly distinct from `update_project`; narrative writes
  are routed exclusively through the serializer bridge.

### Verification
- Python syntax parse OK; `typecheck` + `test` (JS/Git) green (agent is not
  part of the TS build).

---

## Phase 6 — Data migration: legacy fields → committed `docs/` (T10) — DONE

**Objective:** read the legacy flat narrative fields from the **local** dataset,
emit committed Markdown docs under `projects/<slug>/docs/` preserving legacy
anchor headings, and validate the round-trip into `project.content`.

### Files added
- `scripts/migrate-legacy-content.ts` — reads every project's legacy narrative
  fields via a raw GROQ projection and emits `projects/<slug>/docs/*.md` in the
  canonical order (overview → architecture → engineering-decisions → challenges
  → results → demonstrates → examples → lessons-and-limitations →
  future-improvements → timeline → faq), each with `order` front-matter and the
  legacy heading that produces the preserve legacy anchor via the shared
  `generateHeadingId()`. Stale docs (fields cleared) are removed so the docs
  dir is an exact mirror. `architectureImage`, `interestingChallenges`
  (problem/solution/outcome triplets), and `faq` (Q/A) are emitted using the
  serializer's expected syntax.
- `projects/<slug>/docs/*.md` — committed authored source of truth (the plan's
  Step-3.8 repo convention).

### Files modified
- None (changelog).

### Decisions / notes
- The migration reads **all** projects (not just those with `whyIBuiltIt`);
  docs are emitted only for fields that are present, so metadata-only projects
  get no `/docs` (plan §3.8).
- `architectureImage` emitted as `![alt](cdn-url)`; because the serializer
  enforces absolute local image paths, re-publishing a project whose emitted
  docs reference a remote CDN asset will surface a structural error (never a
  partial write). Local image files committed beside the docs round-trip
  cleanly. This matches Risk R5 (alt required) and the serializer's validation.

### Verification
- Typecheck/lint clean; `migrate-legacy-content.ts` generated docs for all 3
  projects; `publish-docs.ts` round-tripped `video-captioning-agent` into the
  **local** dataset (6 blocks) with metadata untouched; re-run confirmed stable
  content-hash `_key`s (idempotent, no block churn).

---

## Phase 7 — Renderer rewrite: project page is content-only (T11) — DONE

**Objective:** the project detail page renders the single `project.content`
Portable Text stream (heading-based sections with stable anchors) instead of
~18 flat narrative fields. New `faqItem` / `challengeCard` block components
render the one-off schema types the serializer emits.

### Files modified
- `components/DocumentationBlocks.tsx`
  - Added `block` renderers for `h2`/`h3`/`h4` that emit `id={headingId(value)}`
    pointing at the shared `generateHeadingId()` (bare mode). This preserves the
    migrated legacy anchors (e.g. `#results`, `#lessons-and-limitations`) so
    deep-link citations keep resolving (R2).
  - Added `types.faqItem` → `<FaqItem>` and `types.challengeCard` →
    `<ChallengeCard>` renderers, plus the `FaqItemValue` / `ChallengeCardValue`
    shapes.
  - Added `FaqItem` and `ChallengeCard` React components (Q/A card and
    problem/solution/outcome card with matching slate palette).
  - `headingId(value)` helper flattening a block via `portableTextBlockToText` →
    `generateHeadingId`.
- `app/projects/[slug]/page.tsx`
  - Removed the legacy flat-field pipeline: `DetailBlock`, `ImageBlock`,
    `ChallengesBlock`, `BeforeAfterBlock`, `FaqBlock`, `PortableContent`,
    `hasImageUrl`, the `demoVideo`/`screenshots`/`beforeAfter`/`detailedContent`
    sections, and the legacy flat-field imports.
  - Renders `<PortableText value={content} components={documentationPortableTextComponents} />`
    when `content` is present (old `detailedContent` only was rendered as
    "Details"); metadata hero (title, status, short summary, cover, metrics,
    technologies, GitHub/demo/doc links) is unchanged.

### Verification
- `npm run typecheck` clean; `npm run lint` only the pre-existing warnings in
  `lib/agent/orchestrator.ts` / `lib/observability/noop.ts`; `npm test` 28
  passed; `npm run build` green (`/projects/[slug]` SSG for both local
  projects).

---

## Phase 8 — T12: index rewrite (content-derived sections) — DONE

**Objective:** the index layer reads `content` Portable Text and derives
sections by heading via the shared PT utilities; metadata chunks preserved.

### Files modified
- `lib/indexing/types.ts` — `SanityProject.content?: PortableTextBlock[] | null`;
  dropped the 11 legacy narrative fields; `projectsQuery` selects `content`.
- `lib/indexing/adapters.ts` — `fallbackToSanityProject` maps metadata only.
- `lib/indexing/chunkers.ts` — `chunkProject` reuses `splitSectionsByHeading()`
  (no inline section-splitting) with `generateHeadingId()` (bare-mode) anchors;
  keeps the short-summary / technologies / key-metrics metadata chunks.

### Files added
- `lib/indexing/chunkers.test.ts`.

### Verification
- `npm test` (31), typecheck, lint (pre-existing warnings), build green.
- Commit: `0f9f1d4 feat(indexing): derive project chunks from content Portable Text sections`.

---

## Phase 9 — T13: document-oriented retrieval + heading probes — DONE

**Files:** `lib/retrieval/structured.ts`, `scripts/index-content.ts`.

- `searchByTechnology` / `getProjectBySlugFromSanity` select `content`;
  `projectToSearchResults()` builds sections from `content` via
  `splitSectionsByHeading()` plus metadata short-summary/tech/metrics summaries.
  No predefined-section reads; no legacy flat fields.
- `buildSemanticProbes` adds one probe per canonical content heading (mirrors
  the existing title probe).

### Verification
- `npm test` (31), typecheck, lint, build green.
- Commit: `507881d feat(retrieval): document-oriented project retrieval + heading probes`.

---

## Phase 14 — T14: manual verification — DONE (embedding backend unavailable)

**Performed:** build green with both published `/projects/<slug>` prerendered
from `content`; verified live content-derived chunking against the **local**
dataset (legacy anchors `#results`, `#lessons-and-limitations`,
`#future-improvements` preserved; metadata-only projects yield only
summary/tech chunks); full gate (typecheck/test 32/lint/build) green.

**Not run (environment prerequisite):** full `npm run index-content` with
semantic probes requires the embedding backend (Ollama at `localhost:11434`),
which was not running; the chunk-fetch step (20 chunks) succeeded and the probe
path is code-verified. Publishing-Agent interactive REPL round-trip was not
exercised headless.

---

## Phase 15a — T15a: remove legacy code references — DONE

**Files:** `sanity/types.ts` (slim `ProjectDetail`, drop
`Challenge`/`BeforeAfterComparison`/`FaqItem`), `sanity/queries.ts`
(`projectBySlugQuery` metadata + `content` only), `scripts/publish-tool.ts`
(metadata-only publish/read types, drop `uploadArchitectureImage`),
`agent/publish_agent.py` (remove `architectureImage` from image/alt sets,
tool-arg lists, `_IMAGE_FIELD_NAMES`, `SYSTEM_PROMPT`). `scripts/migrate-legacy-content.ts`
intentionally keeps reading the legacy dataset fields (one-off migration tool).

**Verification:** typecheck, test (31), lint, build green.
Commit: `ae7b1be refactor(content): remove legacy narrative fields from code surfaces`.

---

## Phase 16 — T15b: remove legacy schema fields — DONE

**File:** `sanity/schemaTypes/project.ts` — dropped `whyIBuiltIt`, `theProblem`,
`theSolution`, `architectureImage`, `engineeringDecisions`,
`interestingChallenges`, `results`, `whatThisDemonstrates`,
`exampleInputsOutputs`, `lessonsLearned`, `limitations`,
`futureImprovements`, `timeline`, `faq`, `detailedContent`,
`problemStatement`, `approach`. Metadata unchanged. `AGENTS.md` rewritten for
the metadata + `content` model, `publish_docs`, and the `docs/` narrative
convention.

**Verification:** typecheck, test (31), lint, build green.
Commits: `0853040 refactor(schema): remove legacy narrative fields from project document`, `eecb173 docs(agents): update project schema for metadata + docs/ content model`.

---

## Phase 16 — T15c: unset local dataset fields + serializer list fix — DONE

**Prep (verification surfaced + fixed):**
- Populated `project.content` for all three local projects via `publish-docs`
  over the committed `projects/<slug>/docs/` directories.
- Fixed a serializer bug: mdast list items wrap inline content in a `paragraph`
  node that the inline walk skipped, yielding **empty list children**. Fixed by
  recursing into `paragraph`; added regression tests. This surfaced on the
  bullet-list-heavy `candidate-ranking-system` content.
- Pinned `candidate-ranking-system/docs/architecture.md` to a committed local
  asset (`architecture-diagram.png`) instead of a remote CDN URL so it
  round-trips (Risk R9/R5).
- Commits: `bf787d4 fix(content): preserve inline text in list-item blocks`, `19019c3 feat(agent): add T15c bridge to unset legacy project fields locally`.

**Files added:** `scripts/unset-legacy-project-fields.ts`.

**Data change (local dataset only):** ran the bridge — cleared 17 legacy
fields on all 3 published projects. Verified no `whyIBuiltIt` remains; `content`
block counts intact (19/6/6); metadata unchanged.

**Verification:** typecheck, test (32), lint, build green.

---

## TODO (remaining phases)

| Task | Status |
|------|--------|
| T16 | Promote local dataset → production, deploy code, reindex, expanded smoke |