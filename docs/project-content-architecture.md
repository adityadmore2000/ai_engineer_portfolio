# Project Content Architecture: Separating Metadata from Engineering Narrative

Status: **Historical design analysis (superseded).** This document analyzed a
`docs/`-directory narrative channel. The implemented final architecture instead
uses one canonical spec file per project — `projects/<slug>/project-spec.md`
(YAML frontmatter metadata + a Markdown narrative body), published wholesale by
`publish_project_spec`. See the [current `spec-format.md`](./spec-format.md).
Companion doc: [`migration-plan.md`](./migration-plan.md)

Revision notes (approved decisions incorporated):

- The recommended architecture (Hybrid) is retained: structured metadata stays
  the source of truth for portfolio infrastructure; rich narrative is no longer
  modeled as dozens of schema fields; narrative is stored as Portable Text in
  Sanity; deep multi-page documentation remains possible via
  `projectDocumentationPage`.
- **The canonical authoring format is Markdown documentation stored in the
  project repository.** Portable Text is only an internal storage format used
  by Sanity. It is never the source of truth and is never described as such.
- The Publishing Agent receives **metadata + a path to a project's `docs/`
  directory**, not one large specification file, and transforms every document
  in that directory into Portable Text.
- **Local-first, replace-style migration.** All work — schema change, data
  migration, renderer/retrieval rewrite — is developed and verified against the
  local dataset, then promoted to production as one step. There are **no**
  feature flags, no dual-read paths, no parallel systems, and no prolonged
  deprecation window. The old implementation is replaced, not maintained
  alongside the new one (see `migration-plan.md`).

This document analyzes the current spec-driven project content model, identifies
the coupling points that prevent narrative content from evolving independently,
evaluates four candidate content models, and recommends one. It is intended to
guide a follow-up implementation; no code was modified.

---

## 1. Current Architecture

### 1.1 Overview

A project is a **single flat Sanity document** (`project`) whose ~30 fields are a
mixture of structured metadata and long-form engineering narrative. The
publishing agent writes these fields by deterministically parsing a rigid
Markdown spec. The public site renders the fields in a hard-coded section order.
The semantic search index and the structured-retrieval layer both read the same
flat fields by name.

```
                      Markdown Spec (.md)
                              │
                              ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Publishing Agent (agent/publish_agent.py)                  │
   │   parse_spec_file ──► describe_project_schema ──►          │
   │   normalize_and_validate ──► (1× LLM self-repair) ──►      │
   │   create_project_from_spec ──► confirm_pending_create      │
   └───────────────────────────────┬───────────────────────────┘
                                   │ JSON payload + __markdownDir__
                                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Mutation layer (scripts/publish-tool.ts)                   │
   │   setGenericFields + image uploads ──► client.create/patch │
   └───────────────────────────────┬───────────────────────────┘
                                   ▼
                        ┌───────────────────────┐
                        │   Sanity  Content Lake │
                        │   project (flat doc)   │
                        └───────────┬───────────┘
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
        GROQ queries        Renderer (Next.js)    Qdrant index
        (sanity/queries.ts) (app/projects/[slug]) (lib/indexing)
                                    │
                                    └──► chat agent retrieval
                                         (lib/retrieval/structured.ts)
```

### 1.2 Sanity schema — `sanity/schemaTypes/project.ts`

A single `project` document type with ~30 visible fields. They fall into two
overlapping groups today:

**Structured metadata (deterministic, queryable):**
`title`, `slug`, `shortSummary`, `status`, `technologies[]`, `githubUrl`,
`demoUrl`, `keyMetrics[]`, `coverImage`, `featured`, `displayOrder`, `published`,
`demoVideo`, `screenshots[]`, `beforeAfterComparisons[]`.

**Engineering narrative (long-form text):**
`whyIBuiltIt`, `theProblem`, `theSolution`, `architectureImage`,
`engineeringDecisions`, `interestingChallenges[]`, `results`,
`whatThisDemonstrates`, `exampleInputsOutputs`, `lessonsLearned`, `limitations`,
`futureImprovements`, `timeline`, `faq[]`, `detailedContent` (Portable Text,
block-only). Two deprecated leftovers: `problemStatement`, `approach`.

Every narrative field is a `markdown` scalar, a markdown-containing object array,
or an image — i.e. each one is a bespoke top-level schema field. The storytelling
hierarchy (Hero → Why → Problem → Solution → Architecture → Decisions →
Challenges → Results → Demonstrates → extras) is **encoded twice**: once as field
ordering in `project.ts`, and again as the hard-coded render order in
`app/projects/[slug]/page.tsx`.

`detailedContent` is the only Portable Text field on the document, but it is
`block`-only — it cannot use the reusable documentation blocks already defined in
`sanity/schemaTypes/documentationBlocks.ts`, and the agent cannot write it.

### 1.3 The Publishing Agent — `agent/publish_agent.py`

A Python REPL driven by an Ollama tool-calling LLM (`qwen3:4b` default) built on
LangGraph. Every mutation shells out to a thin TypeScript bridge.

Spec-driven pipeline (the current focus):

| Stage | Location | Notes |
|-------|----------|-------|
| Parser | `parse_spec_text` / `parse_spec_file` (`publish_agent.py:367`, `:469`) | Deterministic regex: `- **field**: value` bullets, indented sub-bullets, `Not set` markers. Field-name agnostic. |
| Schema discovery | `describe-schema.ts` bridge + `get_discovered_schema` (`publish_agent.py:547`) | Executes each field's `validation` fn against a mock `Rule`; cached, mtime-keyed to `project.ts`. |
| Mapping/validation | `normalize_and_validate` (`publish_agent.py:659`) | Coerces parsed values to discovered types; checks required/uri/integer/min. |
| LLM self-repair | `_llm_repair` (`publish_agent.py:753`) | One `with_structured_output` call constrained to a Pydantic model derived from the schema. |
| Staging | `create_project_from_spec` (`publish_agent.py:805`) | Stashes `PENDING_CREATE` payload; nothing written until `confirm_pending_create`. |
| Write | `create_project` tool → `scripts/create-project.ts` → `scripts/publish-tool.ts` | `setGenericFields` copies every non-meta, non-image field through generically. |

Key properties:

- **Happy path is fully deterministic.** The LLM never authors content; it only
  repairs type coercions once if deterministic validation fails.
- **Live schema discovery.** New scalar/array fields added to `project.ts` are
  picked up automatically (`_writable_field_types`, `publish_agent.py:582`).
- **Object-array fields are not writable.** `_writable_field_types` only maps
  scalars, `markdown`, `url`, `number`, `boolean`, `array<string>`,
  `array<image>`. `interestingChallenges`, `beforeAfterComparisons`, `faq`, and
  `detailedContent` are silently skipped — the spec flow cannot populate the
  richest narrative structures it already has.
- **Prompt drift.** The hard-coded `SYSTEM_PROMPT` field list for
  `create_project`/`update_project` (`publish_agent.py:1107`) is an older,
  smaller subset than the live schema (it lists `problemStatement`, `approach`,
  but not `whyIBuiltIt`, `theProblem`, `engineeringDecisions`, etc.). The LLM
  can only emit the fields it is told about.

### 1.4 Mutation layer — `scripts/publish-tool.ts`

`ProjectPublishInput` (line 15) mirrors the flat schema. `setGenericFields`
(line 74) copies any unknown non-meta field verbatim into the Sanity mutation,
which is why generic scalar additions "just work". Images are uploaded
(`uploadImage`, line 105) and turned into asset references; `__markdownDir__` is
stripped before the write. The layer has no concept of content structure — it is
a flat field setter.

### 1.5 Renderer — `app/projects/[slug]/page.tsx`

A single page that renders the document in a **hard-coded order**:

```
Title/status/summary → cover → Why I Built It → The Problem → The Solution
→ Architecture image → Engineering Decisions → Interesting Challenges
→ Results → What This Demonstrates → Demo video → Screenshots
→ Before/After → Example I/O → Lessons Learned → Limitations
→ Future Improvements → Timeline → FAQ → detailedContent (as "Details")
```

Each section is a bespoke JSX block (`DetailBlock`, `ChallengesBlock`,
`BeforeAfterBlock`, `FaqBlock`, `ImageBlock`) bound to a specific field name.
Adding a new storytelling field therefore requires touching schema + query +
types + renderer.

There is a **second, richer content channel already in production**: the
`projectDocumentationPage` document type (`sanity/schemaTypes/projectDocumentationPage.ts`),
rendered with fumadocs at `/projects/[slug]/[...docSlug]` (sidebar tree, TOC,
prev/next, per-page SEO). Its `body` is a Portable Text array supporting the
eight reusable blocks in `documentationBlocks.ts` (`documentationCodeBlock`,
`documentationMermaidDiagram`, `documentationCallout`, `documentationTable`,
`documentationTimeline`, `documentationBadgeGroup`, `documentationCTAGroup`,
`documentationImage`), rendered by `components/DocumentationBlocks.tsx`. The
publishing agent has **no tools** to create or edit these pages (it only
cascades deletes them).

### 1.6 Semantic search & retrieval — `lib/indexing` and `lib/retrieval`

The vector index and the chat agent's deterministic retrieval both depend on the
flat field names:

- `lib/indexing/types.ts:57` — `projectsQuery` selects 17 flat fields.
- `lib/indexing/chunkers.ts:10` — `chunkProject` builds 14 named chunks
  ("Why I Built It", "The Problem", …) from those fields and synthesizes anchor
  URLs (`/projects/<slug>#why-i-built-it`).
- `lib/retrieval/structured.ts:21` — `extractProjectFields` reads 11 flat fields
  by name to answer structured questions ("which projects use X?").
- `scripts/index-content.ts` — semantic validation probes query project titles.

If a new storytelling section is added to the schema, all four of these must be
edited in lockstep or search silently misses it.

### 1.7 Assumptions embedded in the current model

1. **Narrative is enumerable in the schema.** The set of storytelling sections is
   a finite list of top-level fields. New patterns require schema edits.
2. **Section order is fixed in code.** The renderer's field order is the
   narrative order; reordering narrative requires a code change, not an edit.
3. **Agent field knowledge is dual-source.** The live-schema discovery and the
   hard-coded `SYSTEM_PROMPT` field list must stay in sync or the LLM silently
   drops fields.
4. **Markdown is the storage format.** `markdown` fields are stored as raw
   strings and rendered client-side by `react-markdown`; there is no rich-text
   serialization in the write path and no markdown→Portable Text converter in
   the repository.
5. **Metadata and narrative share one document and one read path.** A list
   query (`getAllProjects`) and a detail query (`getProjectBySlug`) both read
   the same document; there is no separation between "card data" and "story".

### 1.8 Coupling points (summary)

| # | Coupling | Files | Impact of adding a storytelling pattern |
|---|----------|-------|------------------------------------------|
| C1 | Schema field ↔ render order | `project.ts`, `app/projects/[slug]/page.tsx` | Schema edit + renderer edit |
| C2 | Schema field ↔ GROQ projection | `sanity/queries.ts`, `lib/indexing/types.ts`, `lib/retrieval/structured.ts` | Schema edit + 3 query edits |
| C3 | Schema field ↔ agent writability | `publish_agent.py` (`_writable_field_types`, `SYSTEM_PROMPT`) | Schema edit + agent prompt edit |
| C4 | Schema field ↔ chunker | `lib/indexing/chunkers.ts` | Schema edit + chunker edit |
| C5 | Schema field ↔ TypeScript types + fallback data | `sanity/types.ts`, `fallbackContent.ts`, `publish-tool.ts` (`ProjectPublishInput`) | Schema edit + 3 type-surface edits |
| C6 | Narrative string ↔ anchors | `chunkers.ts` (section-name anchors) | Rename/remove a field breaks old URLs |
| C7 | Narrative storage ↔ authoring format | markdown fields everywhere; no md→PT converter | No path to rich narrative (diagrams, callouts, tables) in agent flow |

---

## 2. Gap Analysis

What breaks — or already hurts — as narrative stops fitting into "dozens of
schema fields".

### 2.1 Parser assumptions

- The parser (`_BULLET_RE`) can only express *labelled scalar/array fields*.
  Long-form narrative that does not fit a bullet label (free prose, multiple
  paragraphs per section, nested structure) cannot be represented without
  contorting the grammar.
- The grammar cannot express **order** as content; order comes from field order
  in the schema, not from the document. Reordering narrative means editing the
  schema or the renderer.
- Absent-marker handling (`Not set`, `Not live`, …) is a workaround for
  "optionality of a schema field", not a content concept.

### 2.2 Renderer assumptions

- The renderer is a fixed linear list of typed sections. Every new narrative
  pattern (failure stories, design evolution, tradeoffs, comparison tables)
  requires new JSX plus new schema plumbing.
- There is no "catch-all": a narrative idea with no dedicated field has nowhere
  to go except the block-only `detailedContent`, which the agent cannot write.
- Section typography differs per block (`ChallengesBlock`, `FaqBlock`…), so the
  visual language is duplicated per field.

### 2.3 Schema limitations

- Top-level fields are a poor unit of evolution. Each pattern costs a schema
  release, a Studio migration consideration, type churn (C5), query churn (C2),
  and retrieval churn (C4).
- Nested narrative objects (`interestingChallenges`, `faq`,
  `beforeAfterComparisons`) are **already un-writable by the agent**, so the
  richest content is authored only by hand.
- The schema conflates two concerns: *identity/card data* (queryable, ordered,
  small) and *story* (unbounded, ordered by narrative, extensible).
- `detailedContent` proves the intent to have rich content on the document, but
  it is stranded: block-only, un-writable, and rendered last with a generic
  "Details" heading.

### 2.4 Migration challenges (of the flat model itself)

- Renaming or removing a narrative field silently breaks: queries (C2), the
  chunker's section names and anchor URLs (C4, C6), the fallback adapters (C5),
  and any `SYSTEM_PROMPT` references (C3).
- There is no audit trail mapping "narrative section" → "schema field"; the
  storytelling hierarchy lives in prose in `AGENTS.md`, the field order in
  `project.ts`, and the render order in the page — three places that must agree.
- The semantic index stores section names as anchors; any restructuring of
  narrative invalidates citations the chat agent returns to users.

### 2.5 Strategic gap

The portfolio wants narrative that **grows** (new patterns appear over time)
while metadata stays **deterministic and queryable**. The current model makes
narrative growth cost schema/renderer/retrieval surgery every time. The rest of
this document proposes a model where narrative growth costs nothing but content.

---

## 3. Candidate Content Models

> **Scope note.** Each option below is a candidate *storage representation*
> inside Sanity. Authoring is not part of the choice: regardless of the storage
> model, engineering documentation is authored as modular Markdown documents in
> the project repository, and the Publishing Agent transforms them into
> Portable Text during publishing. The options therefore differ only in how the
> published representation is organized inside the CMS.

### Option A — Single Portable Text document with reusable custom blocks

The project's narrative is stored as one ordered Portable Text array on the
project document (`project.content`), reusing/expanding the existing eight
`documentationBlockTypes`.

> **Important framing (per the approved decision):** this is a *storage*
> model, not an authoring model. The authoring format is modular Markdown
> documents in the project repository; the Portable Text array is only the
> published representation inside Sanity. Portable Text must never be described
> as the source of truth.

```js
// schema (sketch)
// project.content: array of (derived from docs/*.md during publishing)
//   { _type: "block", style: "h2"|"normal"|"blockquote", ... }
//   { _type: "documentationCodeBlock" }
//   { _type: "documentationMermaidDiagram" }
//   { _type: "documentationCallout" }
//   { _type: "documentationTable" }
//   { _type: "documentationTimeline" }
//   { _type: "documentationImage" }
//   { _type: "faqItem" }            // new lightweight block (question + answer)
//   { _type: "challengeCard" }      // new lightweight block (problem/solution/outcome)
```

| Axis | Assessment |
|------|-----------|
| **Authoring** | In the repository: modular Markdown files (`docs/*.md`) with git history, diffs, and reviews. The Studio PT array is a *derived preview*, not an authoring surface. |
| **Rendering** | Excellent: one `PortableContent` pass using the already-shipped `DocumentationBlocks.tsx` components; renderer becomes a single component instead of ~9 bespoke sections. |
| **Querying** | Poor for structure (PT is a blob), but **irrelevant** — narrative no longer needs structured queries; only metadata does. GROQ can still test `count(content)` for emptiness. |
| **Migration** | Good: each legacy field maps to a Markdown document (or section) in the repo, then serialized to a deterministic block sequence; `interestingChallenges`→`challengeCard` blocks, `faq`→`faqItem` blocks, images→`documentationImage`. |
| **Extensibility** | Best: a new pattern is a new `.md` file + heading, or — rarely — one new block type + one renderer component. No top-level field, no query churn. |
| **Agent complexity** | Medium: the agent reads a `docs/` directory and serializes each document → PT blocks instead of mapping fields. Requires building a deterministic md→PT serializer (none exists today). |
| Risks | PT is a derived representation — hand-editing it is lost on the next publish (acceptable; see §5.8). Keep the PT body small by delegating deep dives to doc pages (Option C); the modular authoring prevents any single "huge document". |

### Option B — Ordered array of typed Section objects

```js
// project.sections: array of
//   { _type: "heroSection" | "problemSection" | "architectureSection"
//     | "challengeSection" | "faqSection" | "markdownSection", ... }
```

A closed set of named section objects with their own fields, order held by the
array.

| Axis | Assessment |
|------|-----------|
| **Authoring** | In the repository (Markdown); the typed section array is derived storage, ordered by the publishing pipeline. Studio shows it as a typed array. |
| **Rendering** | Good: iterate array, dispatch each `_type` to a component. |
| **Querying** | Better than A: GROQ can filter `sections[_type == "faqSection"]`. |
| **Migration** | Good: 1:1 field→section mapping. |
| **Extensibility** | Moderate: a new pattern = a new section object type + renderer. It is "schema fields, but namespaced under one array". Schema churn is cheap but still *churn* — the schema remains the taxonomy of narrative, which is exactly what we are trying to escape. |
| **Agent complexity** | Highest of the four: the agent must **classify** narrative into section types (LLM judgment) then serialize per type. A generic `markdownSection` escape hatch reduces but never removes the classification burden. |
| Risks | Duplicates the current field-taxonomy problem one level down; type taxonomy still needs schema releases. |

### Option C — Multiple documentation pages linked to a project

Promote narrative entirely into `projectDocumentationPage` documents (already
built: fumadocs sidebar, TOC, prev/next, per-page SEO, nesting).

| Axis | Assessment |
|------|-----------|
| **Navigation** | Best: a real docs sidebar, deep URLs, per-page SEO/sitemap, TOC. |
| **Scalability** | Best: unbounded pages, each independently editable. |
| **Publishing** | Worst today: the agent has **no** tools to create/edit these pages, and the payload format is Portable Text, so it needs new bridges + md→PT serialization + a page lifecycle (create/reorder/retitle/delete). Markdown docs in the repo map 1:1 to pages, so the tooling is per-page serialization. |
| **Maintenance** | Moderate: content fragments across many documents; the "one narrative" requires cross-page ordering (`order`, `parentPage`), duplicate-heading bookkeeping, and page-management tooling. |
| Risks | The overview page becomes a bare metadata card and the story is *several navigations away* — poor for a recruiter skimming one project page. Fragmentation (the exact risk this task wants to avoid) is inherent. |

### Option D — Hybrid: canonical metadata + a rich Portable Text body, with doc pages for deep dives

Keep metadata fields for infrastructure. Store the narrative as one Portable
Text body on the project (`project.content`, Option A), and **retain**
`projectDocumentationPage` as the optional home for very deep, multi-page
supplementary documentation (Option C) — the two channels serve different
purposes: "the story" vs "the reference".

Authoring for both channels is modular Markdown in the project repository; the
Publishing Agent derives the Portable Text during publishing.

| Axis | Assessment |
|------|-----------|
| **Flexibility** | High: any narrative shape fits the block palette; doc pages absorb unbounded depth. |
| **Maintainability** | High: one renderer, one serializer, one block taxonomy; metadata queries stay tiny and stable. |
| **Authoring** | Best of the four: modular Markdown files in the repo (git-friendly); Studio is used for metadata curation and to preview the published representation. |
| **Long-term evolution** | Best: new patterns are new Markdown documents (content), not schema. When a pattern recurs enough to deserve a first-class block, add one block type — no top-level field churn. |
| Cost | Two content channels to keep coherent; the doc-page channel already exists and already has rendering/tooling, so the marginal cost is low. |

---

## 4. Recommendation

### Adopt the Hybrid model: Markdown authored in the repository, Portable Text as the published representation in Sanity.

The preferred architecture separates **three independent concerns** — authoring,
publishing, and storage — so the engineering documentation is never dictated by
the CMS:

```
Project Repository                              Sanity
┌───────────────────────────────┐                ┌────────────────────────────────┐
│ Structured Metadata           │                │ project (document)             │
│   (metadata.md / spec bullets)│                │   metadata fields              │
│ docs/                         │                │   content: Portable Text       │
│   overview.md                 │  Publishing    │     (derived from docs/)       │
│   architecture.md             │─── Agent ────► │   ...                          │
│   engineering-decisions.md    │                │                                │
│   challenges.md               │                │ projectDocumentationPage*      │
│   results.md                  │                │   (optional deep dives)        │
│   faq.md                      │                └────────────────────────────────┘
│   future-improvements.md      │
└───────────────────────────────┘

     authoring                 publishing                  storage
```

Concretely, inside Sanity a project looks like:

```
Project (Sanity document)
│
├── Metadata (deterministic, queryable — unchanged shape)
│     title, slug, shortSummary, status, technologies[],
│     githubUrl, demoUrl, keyMetrics[], coverImage,
│     featured, displayOrder, published
│
└── Content (a rich, extensible document — the *published* representation)
      project.content: Portable Text array
      ├── h2 + prose (derived from overview.md)
      ├── h2 + prose (derived from architecture.md)
      ├── documentationMermaidDiagram
      ├── documentationCodeBlock
      ├── challengeCard[] (derived from challenges.md)
      ├── faqItem[] (derived from faq.md)
      ├── documentationTable / callout / timeline / image …
      └── (future: any new block type)
│
└── (optional) projectDocumentationPage*  — deep multi-page reference (unchanged)
```

**The abstraction is:**

```
Engineering Documentation          Engineering Documentation
        ↓                                  ↓
     Publishing                        Publishing
        ↓                                  ↓
  CMS Representation                 Schema Fields
        ✓                                   ✗
```

Markdown documents are engineering documents. The Publishing Agent transforms
them into a unified rich content model. Sanity stores the rendered
representation. The CMS does not dictate how engineering documentation is
authored — and **Portable Text is never the source of truth; Markdown
documentation in the repository is.**

Why this beats the alternatives:

1. **Metadata stays deterministic and cheap.** Cards, listing, filtering,
   sorting, SEO, navigation all keep reading the same small field set. The
   "single source of truth for portfolio infrastructure" requirement is
   untouched.
2. **Narrative growth becomes content, not schema.** The #1 failure of the
   current model (C1–C5) disappears: a new storytelling pattern is a new
   Markdown document in `docs/`. Recurring patterns graduate to a block type
   once — one schema object + one renderer component — with zero query, type,
   or agent churn.
3. **Authoring is decoupled from the CMS.** Engineers write modular Markdown
   documents in the project repository with full git history, reviewability,
   and maintainability. This is better than either the current spec grammar or
   a single large Portable Text body: each document is small, diffable, and
   independently reviewable.
4. **The agent stays a mapper, not an author.** Metadata mapping remains
   deterministic. Narrative becomes a deterministic *serialization* task (read
   `docs/`, convert each Markdown document to Portable Text blocks), preserving
   the "never rewrite content" principle. Option B, by contrast, forces the LLM
   to *classify* narrative into a type taxonomy — exactly the judgment work the
   current design deliberately avoids.
5. **Order becomes a content property.** The documents are ordered
   deterministically (`order` front-matter or filename order), which drives the
   Portable Text ordering. Reordering is a Markdown edit, not a code change.
6. **The infrastructure already exists.** `documentationBlocks.ts` (8 reusable
   blocks), `DocumentationBlocks.tsx` (renderer), `PortableContent.tsx`, and the
   `projectDocumentationPage` channel are all in production. The project
   document even has a stranded `detailedContent` field pointing in exactly this
   direction. This is mostly an exercise in *reusing* rather than building.

Trade-offs, accepted deliberately:

- **No per-section structured querying of narrative.** We do not need it —
  retrieval flattens PT to text for the vector index and cites by section
  heading instead of field name. Metadata covers all infrastructure queries.
- **Portable Text is internal storage only.** It is a derived representation;
  manual edits to `content` inside Studio are overwritten on the next publish.
  This is accepted and documented (see §5.8) — Markdown is the source of truth.
- **We must build an md→PT serializer plus `docs/` discovery** (no such code
  exists). It is bounded, deterministic, and testable (see `migration-plan.md`
  §3).
- **The taxonomy moves from "fields" to "block types".** A recurring pattern
  still requires one schema+renderer addition — but this is *rare* (a handful a
  year) rather than *per narrative section*, and it never touches queries, the
  agent prompt, the chunker, or types elsewhere.

The long-term mental model the task describes — `Project { Metadata, Content }`
with a rich extensible document for the story — is exactly what this delivers,
and it does so by keeping authoring (Markdown), publishing (the agent), and
storage (Sanity) as three independent concerns.

---

## 5. Risks

### 5.1 Schema lock-in

- **Risk:** If we chose Option B, the schema (section taxonomy) would still
  constrain narrative evolution; new patterns need schema releases forever.
- **Mitigation (chosen model):** narrative is schema-free content. The only
  remaining taxonomy is the block palette, which is open and additive; adding a
  block never invalidates existing content (older docs keep rendering via their
  own block types).
- **Operational guard:** the schema is revised once, locally — `content` is
  added and the legacy narrative fields are removed in the same revision, with
  every read surface (types, queries, fallback, bridges) updated in the same
  change (see `migration-plan.md` §4). There is no hidden/deprecated transitional
  schema: the local dataset carries the legacy data until Phase 4 migrates it,
  and production is promoted whole, so no partially-migrated schema ever serves
  traffic.

### 5.2 Rendering complexity

- **Risk:** one generic renderer could regress per-section typography that
  today's bespoke blocks (ChallengesBlock, FaqBlock, BeforeAfterBlock) provide.
- **Mitigation:** the block palette already encodes most of this typography
  (`documentationCallout` variants cover lesson/limitation/future; new
  `challengeCard`/`faqItem` blocks inherit the card styling). Renderer work is a
  *port*, not a rewrite; keep the visual language identical and verify with
  visual checks in the local dataset before promotion.
- **Risk:** PT block order is arbitrary → a project could start mid-narrative.
  **Mitigation:** the publishing pipeline emits sections in `docs/` order
  (front-matter `order` or filename order), so narrative order is controlled by
  the Markdown documents, not by ad-hoc Studio edits. The data migration emits
  documents that preserve the canonical headings (see `migration-plan.md` §6).

### 5.3 Content fragmentation

- **Risk:** narrative split across `docs/` Markdown files, the derived
  `content` PT body, and doc pages becomes hard to find or duplicated.
- **Mitigation:** the `docs/` Markdown documents in the repository are the
  single source of the story; `project.content` and the doc pages are *derived
  representations* produced by publishing. The index (`index-content.ts`)
  flattens every channel into search, so nothing is lost to discovery.
- **Guard:** there is never a dual-write window. The renderer and retrieval are
  rewritten to `content`-only in the same local change as the schema revision
  (no legacy read fallback exists at any point), and the local verification gate
  (`migration-plan.md` §7) confirms nothing depends on the old fields before
  production is promoted whole.

### 5.4 Editor experience

- **Risk:** moving away from Studio-based editing could be seen as a regression
  for non-technical editors.
- **Mitigation:** the canonical authoring surface is Markdown in the project
  repository — familiar Markdown editors/IDEs, git diffs, and PR review. Studio
  remains the home for metadata curation and for previewing the published
  representation. There is no transitional rendering state: legacy `markdown`
  fields are not kept readable mid-transition because no transition period
  exists — render parity is verified against the Phase 0 snapshots on the local
  dataset before production is promoted whole (`migration-plan.md` §7). For
  genuinely long-form reference material, the `projectDocumentationPage` channel
  is still available for editors who prefer Studio.

### 5.5 Long-term maintenance

- **Risk:** a brand-new content model becomes a second system the agent, the
  renderer, and search must all understand — more moving parts than today.
- **Mitigation:** the model *removes* moving parts: one narrative renderer
  instead of nine sections, one `docs/` reader + serializer instead of
  per-field mapping, one block taxonomy instead of a growing field list. The
  chunker and structured retrieval become content-agnostic (flatten PT → text;
  cite by heading) and stop changing when content changes.

### 5.6 Agent regression risk

- **Risk:** changing the agent's writable-field set could break the proven
  deterministic metadata path or the LLM self-repair fallback.
- **Mitigation:** metadata mapping is left untouched; narrative writes are routed
  through a *new* deterministic serializer behind a new tool. The existing
  `create_project`/`update_project` bridges are unchanged and metadata-only
  before and after the revision — there is no transitional compatibility layer,
  because the schema revision is one local change promoted whole.
  `content` is never part of `ProjectPublishInput`; it is written exclusively by
  the `publish_docs` bridge. The `SYSTEM_PROMPT` hard-coded field list is
  regenerated from the live schema (or removed in favor of schema discovery) to
  kill drift (C3).
- **Risk:** `_writable_field_types` would silently pick up a new
  `content`/`sections` array. **Mitigation:** explicitly exclude Portable Text /
  object arrays from the writable set (as `detailedContent` is today) and route
  narrative to the serializer.

### 5.7 Retrieval & citation stability

- **Risk:** section-name anchors (`/projects/<slug>#why-i-built-it`) that the
  chat agent cites change when narrative becomes headings.
- **Mitigation:** the chunker and `structured.ts` move to heading-based section
  names derived from the PT body, so anchors are content-derived and stable. Old
  anchors continue to work because the migration preserves the canonical
  headings from the Markdown documents. Semantic validation probes in
  `index-content.ts` are extended to check that a project's headings are
  retrievable (mirroring the existing title probe, `scripts/index-content.ts:23`).

### 5.8 One-way publish: Portable Text as derived data

- **Risk:** someone treats `project.content` (or the doc-page bodies) as the
  source of truth and edits it in Studio, or the md→PT serializer loses
  information, producing a degraded published page.
- **Mitigation (representation):** Markdown documents in `docs/` are the single
  source of truth. `project.content` is overwritten on every publish (a
  `replace`, with stable `_key`s for diffing). Studio's `content` field is
  labelled "published representation — do not edit; edit the Markdown source".
  Any curation that must happen outside the repo goes through the doc-page
  channel or through the agent.
- **Mitigation (fidelity):** the serializer is deterministic and validated
  (balanced code fences, closed tables, absolute image paths, size caps), with
  a `--check` mode that compares the serialized PT against the Markdown AST so
  lossy round-trips are caught in CI before publishing.

---
*Continue to [`migration-plan.md`](./migration-plan.md) for the local-first
rollout and publishing-agent impact.*
