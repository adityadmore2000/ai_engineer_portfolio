# Migration Plan: Metadata / Narrative Separation

Status: **Historical design proposal (superseded).** The architecture described
below — the `docs/`-directory narrative channel — was replaced by the canonical
`project-spec.md` model: one spec file holds metadata frontmatter **and** a
Markdown narrative body, published wholesale by `publish_project_spec`. See the
[current `spec-format.md`](./spec-format.md).
Companion doc: [`project-content-architecture.md`](./project-content-architecture.md)

Revision notes (approved decisions incorporated):

- The publishing pipeline is organized around a **documentation directory**, not
  a single narrative blob or a single large spec file. The Publishing Agent
  receives metadata plus a path to a project's `docs/` directory, performs
  deterministic discovery of the Markdown documents inside it, converts them to
  Portable Text, and publishes into Sanity while preserving existing structured
  metadata.
- **Markdown documentation in the repository is the source of truth. Portable
  Text is only the internal storage format used by Sanity.**
- **Local-first, replace-style migration.** All work — schema change, data
  migration, renderer/retrieval rewrite — is developed and verified against the
  local dataset, then promoted to production as one step. There are **no**
  feature flags, no dual-read paths, no parallel systems, and no prolonged
  deprecation window. The old implementation is replaced, not maintained
  alongside the new one.
- **Process revision.** This version documents the migration as a
  single-developer, local-first implementation roadmap rather than an enterprise
  rollout. Git history is the only snapshot and rollback mechanism (no dataset
  exports, scratch artifacts, or parity baselines), verification is manual, and
  the obsolete legacy implementation is removed only after the new one is
  verified. The architecture is unchanged; only the process is simplified.

Target model (from the architecture doc, §4):

```
Project repository                          Sanity
┌───────────────────────────────┐            ┌──────────────────────────────┐
│ Structured Metadata           │            │ project (document)           │
│   (metadata.md / spec bullets)│            │   metadata fields            │
│ docs/                         │ Publishing │   content: Portable Text     │
│   overview.md                 │── Agent ──►│     (derived from docs/)     │
│   architecture.md             │            │   ...                        │
│   engineering-decisions.md    │            │                              │
│   challenges.md               │            │ projectDocumentationPage*    │
│   results.md                  │            │   (optional deep dives)      │
│   faq.md                      │            └──────────────────────────────┘
│   future-improvements.md      │
└───────────────────────────────┘
```

The plan is local-first and replace-oriented. The local dataset is pulled from
production, the entire change is built and verified there, and production is
promoted in a single step (dataset `local-to-prod` + code deploy). The old
flat-field implementation is not kept in parallel at any point.

---

## 1. Principles

1. **Replace after local verification, not dual-run.** The schema change, data
   migration, and renderer/retrieval rewrite are developed as one change against
   the local dataset and verified end-to-end there. Production is promoted once,
   when the local result is verified. No feature flags, no dual-read paths, no
   parallel systems.
2. **Deterministic transformation.** The `docs/` discovery + md→PT serializer
   and the legacy→Markdown migration script are pure functions of (schema,
   documents, content). No LLM in the migration path — consistent with the
   agent's "mapper, not author" ethos.
3. **Markdown-in-repo is the source of truth.** The authored artifacts are
   `docs/*.md` files committed to git. `project.content` is a derived,
   overwritten-on-publish representation; Portable Text is never treated as a
   source of truth.
4. **Local-first.** Every step runs against the local dataset (pulled from
   production via `sync-dataset.ts prod-to-local --replace`). Production is
   never half-migrated; it is only touched by the final promotion.
5. **Revalidation of the whole graph.** `revalidate = 60` (ISR) plus the
   transactional Qdrant rebuild (`npm run index-content`) are part of the
   verification before promotion and are re-run after promotion.
6. **Git is the snapshot and rollback mechanism.** No dataset exports,
   rendered-page snapshots, or scratch copies are kept. The working tree plus
   commit history reproduce any state and undo the migration.

---

## 2. The workflow at a glance

The migration is a single feature-branch effort against the local dataset. Each
step is one or more commits; the whole branch is the migration, and rolling back
is `git revert`.

| # | Step | Outcome |
|---|------|---------|
| 1 | Implement the new architecture against the local Sanity dataset | local data on the new model |
| 2 | Verify every project page manually | pages render from `content` |
| 3 | Verify the Publishing Agent end-to-end | publishing pipeline works |
| 4 | Verify search and indexing | retrieval + index valid |
| 5 | Remove obsolete legacy code and schema | legacy-free model |
| 6 | Sync the verified local dataset to production | production on the new model |

---

## 3. Step 1 — Implement the new architecture against the local dataset

All build work happens against the local dataset and the local site. Production
is untouched until Step 6.

### 3.0 Prepare the local dataset

Pull production into the local dataset so the work runs against real content:

```
sync-dataset.ts prod-to-local --replace
```

As the primitives below land, add or extend the regression tests that anchor
them: the deterministic parser grammar, the schema-discovery mock
(`describe-schema.ts`), the **Markdown-document discovery rules**, the md→PT
serializer output, the chunker output shape, and the structured-retrieval field
mapping.

### 3.1 Documentation discovery (`lib/content/discover-docs.ts`)

The Publishing Agent receives a **path to a project's `docs/` directory**, not a
single spec file. Discovery is deterministic:

- Scan the directory (recursively) for `.md` files only; ignore `README.md`
  unless intended, hidden files, and non-Markdown assets.
- **Order** each document via an explicit `order` front-matter field when
  present, falling back to a stable filename sort. Ordering is a document
  property, not a schema field.
- Enforce per-file and per-directory **size caps** (protecting the model's
  context window and the PT document size).
- Reject malformed front-matter loudly; a missing file is fine (a project may
  have any subset of documents).
- Return `[{ file, order, heading, raw }]` in deterministic order. Each file is
  an **engineering document**, not a schema field.

```
docs/
├── overview.md              → project.content section (h2 "Overview")
├── architecture.md          → … + documentationMermaidDiagram
├── engineering-decisions.md → …
├── challenges.md            → challengeCard[]
├── results.md               → …
├── faq.md                   → faqItem[]
└── future-improvements.md   → …
```

### 3.2 Serializer design (`lib/content/markdown-to-pt.ts`)

```
docs/*.md ──► deterministic parser ──► Portable Text blocks (one section per file)
```

| Markdown input | Portable Text output |
|----------------|----------------------|
| file title / `# Heading` / `## Heading` | `{_type: "block", style: "h2"}` (document titles become h2; sub-sections h3/h4) |
| paragraph | `{_type: "block", style: "normal", children: [...]}` |
| `- item` / `1. item` | `{_type: "block", listItem: "bullet"|"number", ...}` |
| `` `code` `` / `` ```lang\n...\n``` `` | `code` mark / `documentationCodeBlock` |
| ` ```mermaid\n...\n``` ` | `documentationMermaidDiagram` |
| `> **Callout**: body` | `documentationCallout` (variant derived from keywords: limitation/lesson/future/warning) |
| Markdown table | `documentationTable` |
| `![alt](path)` | `documentationImage` (asset uploaded; absolute paths enforced, reusing `uploadImage` in publish-tool.ts) |
| `- **Q:** ...` / `- **A:** ...` pairs | `faqItem` blocks |
| `**Problem:**…` / `**Solution:**…` / `**Outcome:**…` triplets | `challengeCard` blocks |

The serializer is **schema-free**: it does not need to know "which sections
exist" — any document/heading renders to blocks, so new storytelling documents
are free. Each file produces a named section; sections are concatenated in
discovery order into `project.content`.

### 3.3 Serializer & discovery requirements

- **Stable `_key`s** derived from content hashes so partial updates and
  diffing are possible and re-runs are idempotent.
- **Structural validation** (deterministic): balanced code fences, closed
  tables, absolute image paths, size caps. Errors surface to the caller; the
  serializer never silently drops content.
- **`--check` mode** comparing serialized PT against the Markdown AST so lossy
  round-trips are caught before publishing (architecture doc §5.8).
- **Test vectors**: the existing spec grammar cases + representative long-form
  narrative + every `documentationBlockTypes` shape + multi-file `docs/`
  directory ordering.

### 3.4 Schema revision — add `content`

The schema gains `content` now; the legacy narrative fields stay defined (after
§3.7 nothing reads them, but they are removed only in Step 5 — verify the new
model first, then delete the old). There is no production deprecation window:
nothing is promoted until Step 6, and the promoted schema is the clean one.

#### `project` document (`sanity/schemaTypes/project.ts`)

- Add `content: array` with `of`:
  - the standard `block` (h2/h3/h4/normal, bullet/number lists, code/strong/em/underline marks, link annotation),
  - the existing eight `documentationBlockTypes` from `documentationBlocks.ts`,
  - new `faqItem` and `challengeCard` object types (thin wrappers around the
    current `faq`/`interestingChallenges` field shapes).
- `validation: Rule.min(1).optional()` — a project may still be metadata-only.
- Metadata fields (`title`, `slug`, `shortSummary`, `status`, `technologies[]`,
  `githubUrl`, `demoUrl`, `keyMetrics[]`, `coverImage`, `featured`,
  `displayOrder`, `published`, `demoVideo`, `screenshots[]`,
  `beforeAfterComparisons[]`) are unchanged.
- **Update every read surface in the same change**: `sanity/types.ts`
  (`ProjectDetail.content?: ProjectContentBlock[]`, reuse/extend
  `ProjectDocumentationPage` block types), `sanity/queries.ts`
  (`projectBySlugQuery` selects `content`), `sanity/fallbackContent.ts` +
  `lib/indexing/adapters.ts` (fallback projects carry `content` or become
  metadata-only), and `scripts/publish-tool.ts` (`ProjectReadOutput`/
  `readProject` return metadata + `content` flattened). Reads of the legacy
  narrative fields are dropped in Step 5.
- `content` is **derived storage**: it is populated by publishing `docs/*.md`
  (§3.1/§3.2 tooling), never treated as an authored source of truth.

### 3.5 Registration surfaces

- `scripts/describe-schema.ts` — extend to a generic document-type argument
  (currently hard-coded to `project`, `describe-schema.ts:208`) so `content` and
  its block types are discoverable by the agent like any other field.
- `scripts/publish-tool.ts` — **keep `ProjectPublishInput` metadata-only.** Do
  not route `content` through the metadata create/update bridges; `content` is
  written exclusively by the `publish-docs` bridge (§9.6), preserving the
  separation between the metadata and documentation pipelines.

### 3.6 Studio

- Metadata fields stay first; `content` is the narrative editor surface. The
  legacy narrative fields (still present until Step 5) are unused by the public
  site.

### 3.7 Renderer & retrieval rewrite (single code path)

Because nothing reads the legacy narrative fields anymore, there is no fallback
path to maintain. The renderer and retrieval read `content` only — **no feature
flag, no `if content else legacy` branch**.

#### Project page — `app/projects/[slug]/page.tsx`

```
Page = Metadata hero (unchanged: title, status, summary, cover,
       keyMetrics sidebar, tech tags, GitHub/demo/doc links)
     + Narrative  <PortableContent value={project.content}/>
```

- Replace the ~9 bespoke narrative section blocks with a single
  `PortableContent` pass, mapping per-section typography into the shared
  `documentationPortableTextComponents` (`components/DocumentationBlocks.tsx`)
  so the visual language is preserved.
- New renderer components: `challengeCard`, `faqItem` map to the existing card
  visual language (`ChallengesBlock`/`FaqBlock` styling).
- `detailedContent` is superseded by `content`; the "Details" section is gone.
- Projects with no `content` (metadata-only) render the metadata hero alone.

#### Retrieval & indexing (same change)

- `lib/indexing/types.ts` — `projectsQuery` selects `content` (PT) and the
  metadata fields for published projects.
- `lib/indexing/chunkers.ts` — `chunkProject` flattens `content` PT → text,
  splits on heading blocks into sections named by the heading text (anchor
  `#<heading-slug>`). Sections are content-derived and stable; new documents
  index automatically.
- `lib/retrieval/structured.ts` — `extractProjectFields` builds `SearchResult[]`
  from `content` sections by heading; the technology/metrics summary results
  continue to read `technologies`/`keyMetrics` (metadata — unchanged).
- `scripts/index-content.ts` — extend semantic probes: for each project, expect
  its canonical headings to be retrievable (mirroring the existing title probe,
  `index-content.ts:23`). Rebuild the index via the existing transactional
  manager (blue-green alias swap) — no new infra.

### 3.8 Data migration (local-only)

#### Migration script (`scripts/migrate-legacy-content.ts`)

Run against the **local** dataset (which still contains the legacy narrative
data from the Step 3.0 pull). For each published project:

1. Read the legacy flat fields via a raw GROQ projection (the fields still exist
   in the local dataset — they are not removed until Step 5).
2. Emit Markdown documents under `projects/<slug>/docs/` in the *current*
   rendered order:
   `overview.md` (Why I Built It / The Problem / The Solution) →
   `architecture.md` (`architectureImage` → image link) →
   `engineering-decisions.md` → `challenges.md` (`interestingChallenges` →
   `**Problem:**…` / `**Solution:**…` / `**Outcome:**…` triplets) →
   `results.md` → `demonstrates.md` (What This Demonstrates) →
   `examples.md` (Example I/O / demo video / screenshots) →
   `lessons-and-limitations.md` → `future-improvements.md` →
   `timeline.md` → `faq.md` (`- **Q:** …` / `- **A:** …` pairs).
   Each document's title becomes an `h2`; sub-sections become `h3`/`h4`.
   Headings **preserve the legacy anchor names** (`#why-i-built-it`, …) so
   existing chat citations keep working. `order` front-matter pins the canonical
   sequence.
3. Commit the generated `docs/` to git so the authored source exists with a
   reviewable history (Markdown is the source of truth).
4. Run the §3.1/§3.2 publishing pipeline over the committed `docs/` directory
   (`publish-docs`, §9.6) to populate `project.content`.
5. Output a per-project diff summary (docs produced, content blocks, metadata
   untouched). The legacy narrative data is left in place until Step 5.

#### Projects with no legacy narrative

Metadata-only projects get no `docs/` and no `content`; the metadata hero
renders alone — the design supports it.

---

## 4. Step 2 — Verify every project page manually

Run the local site and walk through every `/projects/<slug>` page:

- The metadata hero renders unchanged (title, status, summary, cover,
  keyMetrics sidebar, tech tags, GitHub/demo/doc links).
- The narrative renders from `content`: section order and content match the
  authored `docs/`, and each block type renders correctly — headings, lists,
  code blocks, mermaid diagrams, callouts, tables, images, `challengeCard` and
  `faqItem` cards.
- Legacy anchors (`#why-i-built-it`, …) still resolve so existing chat citations
  keep working.
- Metadata-only projects render the metadata hero alone.
- `/projects/<slug>` and doc-page routes resolve; the sitemap is intact.

Then run the standard dev gate: `npm run lint`, `npm run typecheck`,
`npm run build`.

---

## 5. Step 3 — Verify the Publishing Agent end-to-end

Run the agent against the local dataset and exercise the full publishing loop:

- **`publish_docs`** — point it at a project's `docs/` directory; confirm
  `project.content` is patched in the local dataset and the page reflects the
  change. Edit a document, re-publish, and confirm the diff is driven by the
  Markdown (stable `_key`s, idempotent re-runs).
- **Metadata path** — create a test project via `create_project`, update it via
  `update_project`, then delete it. Confirm these write metadata only and never
  touch `content`.
- **Spec-driven create** — `<path> add project considering this spec` works end
  to end (parse → schema map → confirm → write).
- **Read path** — `read_project` returns `content` so the agent can summarize or
  quote it back.
- **Separation** — a `publish_docs` never mutates `title`, `status`,
  `technologies`, URLs, `published`, etc.

---

## 6. Step 4 — Verify search and indexing

- Rebuild the local semantic index: `npm run index-content` (transactional
  blue-green rebuild — no new infra).
- Semantic probes pass: each project's title **and** its canonical headings are
  retrievable.
- Chat citations point at valid sections/anchors (the migration preserved the
  legacy anchor names).
- Structured retrieval still returns the technology/metrics summary results from
  the unchanged metadata fields.

---

## 7. Step 5 — Remove obsolete legacy code and schema

Only after the new model is verified locally, delete the old one. Everything is
in git, so this is a clean removal, not a deprecation window:

- Remove the legacy narrative fields from `sanity/schemaTypes/project.ts`:
  `whyIBuiltIt`, `theProblem`, `theSolution`, `architectureImage`,
  `engineeringDecisions`, `interestingChallenges`, `results`,
  `whatThisDemonstrates`, `exampleInputsOutputs`, `lessonsLearned`,
  `limitations`, `futureImprovements`, `timeline`, `faq`, `detailedContent`,
  and the already-deprecated `problemStatement`/`approach`.
- Drop the legacy reads and types that are now unused: `sanity/types.ts`,
  `sanity/queries.ts`, `sanity/fallbackContent.ts`, `lib/indexing/adapters.ts`,
  `scripts/publish-tool.ts`, and any remaining legacy section components in the
  renderer.
- Drop the legacy entries from the agent's `_writable_field_types`
  (`publish_agent.py`).
- Unset the legacy narrative data in the local dataset
  (`client.patch(id).unset([...legacyFields])`) so the promoted dataset carries
  only the new model. Metadata is never touched.
- Confirm no references remain: `rg "whyIBuiltIt|theProblem|..." app lib
  scripts sanity`.
- Re-run `npm run lint`, `npm run typecheck`, `npm run build`, spot-check a
  couple of pages, then commit.

---

## 8. Step 6 — Sync the verified local dataset to production

Promotion is a single step; there is no parallel system to coordinate:

1. Push the verified local dataset to production:
   `sync-dataset.ts local-to-prod --replace` (whole-dataset replace — the
   existing, documented destructive promotion path).
2. Deploy the application code (schema, renderer, retrieval, and agent changes
   land together — the schema revision is code).
3. Rebuild the production semantic index via `reindex_content` (transactional,
   blue-green).
4. Smoke-check: `/projects/<slug>` pages, sitemap, chat citations.

Rollback is a git revert. The entire change (code, schema, and `docs/`) is
committed, so reverting the migration branch restores the previous
implementation. No dataset export or scratch artifact is kept — narrative
content is derived from git-tracked `docs/`, and metadata is untouched by the
migration.

---

## 9. Publishing Agent Impact

### 9.1 Mental model change

```
Before:  one big spec   → field map → schema fields (one per narrative section)
After:   metadata       → field map → metadata fields      (unchanged, deterministic)
         docs/*.md      → md→PT serializer → project.content (per document)
```

The agent remains a **schema-aware mapper, never an author**: metadata is
mapped verbatim to fields; each Markdown document is passed through verbatim to
the serializer. The only new code is documentation discovery + serialization,
both deterministic.

### 9.2 Input format

The Publishing Agent receives **metadata plus a path to a project's `docs/`
directory** — not one large specification file:

```
project/
├── metadata.md (or existing spec bullets / natural-language metadata)
└── docs/
    ├── overview.md
    ├── architecture.md
    ├── engineering-decisions.md
    ├── challenges.md
    ├── results.md
    └── faq.md
```

- **Metadata** continues to arrive as structured metadata (the existing
  `- **field**: value` bullets in `metadata.md`/spec, or a natural-language
  request routed to `update_project`/`create_project`).
- **Narrative** arrives as the `docs/` directory path. The agent reads every
  Markdown document inside it — that is the expected publishing workflow, not
  the current single-file spec flow.

### 9.3 Parsing responsibilities

- **Metadata**: unchanged — deterministic bullet parser → `fields` map.
- **Narrative**: the agent performs deterministic **documentation discovery**
  (Step 1 §3.1): scan `.md` files, order them via `order` front-matter or
  filename, enforce size caps, and hand each document to the serializer. Each
  file is an engineering document that maps to Portable Text sections; no
  field-name taxonomy is applied.

### 9.4 Validation

- **Metadata**: unchanged — `normalize_and_validate` against the discovered
  schema (+ the one LLM self-repair retry). With the legacy narrative fields
  gone from the schema, this path is purely metadata.
- **Narrative**: discovery + serializer structural validation (balanced fences,
  closed tables, absolute image paths, size caps, valid `order`). No schema
  membership test, so new documents never fail validation.
- `_writable_field_types` (publish_agent.py:582) continues to skip block/object
  content (as it already skips `detailedContent`), so `content` is never treated
  as a scalar metadata field.

### 9.5 Content serialization

- New tool `publish_docs(slug, docs_dir)` calls the serializer bridge
  (`scripts/publish-docs.ts`) which discovers the directory, serializes every
  document to PT blocks, and patches `project.content` — a **replace** of the
  narrative (with stable `_key`s to allow future append/insert).
- Serialization is deterministic and idempotent; the LLM is not involved.
- An update is triggered by re-pointing at the same `docs/` directory after
  edits — the diff is driven by the Markdown changes, not by LLM re-authoring.

### 9.6 Sanity mutation generation

- New bridge `scripts/publish-docs.ts <slug> <docs-dir>`:
  1. discover Markdown documents deterministically,
  2. serialize each to PT blocks,
  3. structural validation (+ `--check` round-trip comparison),
  4. image uploads (reuse `uploadImage`; absolute paths only),
  5. `client.patch(id).set({ content: blocks })`.
- **Preserving existing structured metadata**: the metadata path is untouched —
  `create_project`/`update_project` continue to write only the metadata fields;
  `publish_docs` only ever touches `content`. A publish of `docs/` never
  mutates `title`, `status`, `technologies`, URLs, `published`, etc.
- `read_project` output includes `content` (as PT or flattened text) so the
  agent can summarize/quote it back.

### 9.7 Future extensibility

- **New storytelling pattern** → author writes a new Markdown document in
  `docs/` (e.g. `failure-stories.md`, `design-evolution.md`); the pipeline
  discovers it, serializes it, indexes it by heading, and renders it. **No
  agent changes.**
- **New reusable component** (e.g. an interactive "design evolution" slider) →
  one new block type in `documentationBlocks.ts` + one renderer component +
  one serializer rule (e.g. a fenced directive). The agent's tool surface does
  not change.
- The agent's live-schema discovery continues to govern metadata; narrative
  needs no schema knowledge at all — a strict reduction in coupling.

---

## 10. Sequence of work (summary checklist)

| # | Work | Outcome |
|---|------|---------|
| 1 | Pull prod→local; build discovery + serializer + tests; add `content` to schema (types/queries/fallback/read bridges); rewrite renderer + retrieval to `content`-only; migrate legacy data → committed `docs/` → `content` | Local dataset on the new model; `docs/` committed |
| 2 | Manually walk every `/projects/<slug>` page; verify block rendering, anchors, routes; lint/typecheck/build | Pages render from `content` |
| 3 | Exercise the Publishing Agent locally: `publish_docs` round-trip, metadata create/update, spec-driven create | Publishing pipeline verified |
| 4 | `npm run index-content` + semantic probes; chat citations; structured retrieval | Search/index verified |
| 5 | Remove legacy narrative fields/code/data; grep for stragglers; lint/typecheck/build; commit | Legacy-free model |
| 6 | Sync local→prod (`local-to-prod --replace`), deploy code, rebuild prod index, smoke check | Production on the new model |

## 11. Non-goals

- No change to `projectDocumentationPage` semantics (deep dives stay as-is).
- No LLM-authored content in the migration path.
- No change to metadata field semantics or the dataset-sync tooling.
- No change to the transactional Qdrant indexing machinery.
- No feature flags, no dual-read paths, no long-running deprecation of legacy
  narrative fields — the transition is a local replace, not a parallel system.
- No dataset exports, snapshots, or scratch artifacts — Git history is the only
  snapshot and rollback mechanism.
- Portable Text is never the authored source of truth: `project.content` is a
  derived, overwritten-on-publish representation; editing narrative happens in
  `projects/<slug>/docs/*.md`.
