# Publishing Agent — User Guide

This guide explains how to work with the Portfolio **Publishing Agent**, a
natural-language assistant that manages projects in the Sanity CMS portfolio
and keeps the site, its documentation, and its semantic search index in sync.

The agent is a **schema-aware mapper, never an author**. It copies your content
verbatim into the matching Sanity fields, coerces types, and flags ambiguity. It
does not rewrite, summarize, or invent content. The canonical spec file you
author in the repository —
[`projects/<slug>/project-spec.md`](./spec-format.md) — is the single source of
truth for a project's metadata **and** narrative; the agent publishes a derived
copy of it into Sanity.

---

## 1. Publishing Agent capabilities

The agent exposes a set of dedicated operations. Every operation is a distinct
tool — the agent must not substitute one for another.

### Read-only / inspection

| Capability | What it does | When to use |
|---|---|---|
| **List projects** | Lists all projects, optionally filtered by title. Returns `title`, `slug`, and `published` visibility for each. | Finding a project's slug, checking visibility, scanning what exists, or disambiguating a name. |
| **Read a project** | Returns a single project's full current data from Sanity by `slug` — metadata, alt texts, and its published Portable Text content. | Reviewing a project's current state before an update, or verifying what is actually stored. |
| **Read a file from disk** | Reads the full contents of any file on disk. | Inspecting `project-spec.md` files or other repo files the user points at. |
| **Find Markdown** | Recursively lists all `.md` files inside a directory. | Locating spec files and other Markdown documents. |
| **List a directory** | Lists entries (files and subdirectories) in a directory. | Exploring the repository layout. |
| **Describe project schema** | Discovers the live `project` document schema from `sanity/schemaTypes/project.ts` (the single source of truth). | Understanding which fields exist, which are required, and their types before authoring a spec. |

### Project lifecycle (mutation)

| Capability | What it does | When to use |
|---|---|---|
| **Create a project** | Creates a brand-new project. Fails loudly if the slug already exists. Requires `title` and `slug`; all other metadata (summary, images, technologies, metrics, URLs, featured, display order) is optional. | Bringing a brand-new project into the portfolio for the first time. |
| **Update a project** | True **partial update** of an **existing** project. Only the fields you include are changed; everything else is preserved. Fails if the slug is not found. | Editing any metadata field on an existing project: summary, status, technologies, URLs, images, order, featured. |
| **Publish a project** | Sets `published = true`, making one project visible on the public portfolio. A pure visibility toggle. | Making an existing (drafted or already-hidden) project live. |
| **Unpublish a project** | Sets `published = false`, hiding one project from the public portfolio. | Taking an existing project down (e.g. WIP, or no longer wanted publicly). |
| **Delete a project** | Permanently removes a project and all of its documentation pages from Sanity. | Irreversible removal of a project. |

### Complete project publication (metadata + narrative)

| Capability | What it does | When to use |
|---|---|---|
| **Publish a project spec** (`publish_project_spec`) | Publishes a **complete** project from ONE canonical `project-spec.md`: frontmatter metadata via create/update **and** the Markdown body serialized into `project.content` as a **replace** (stable keys → idempotent re-runs). `mode=create` fails if the slug exists; `mode=update` patches the existing project. | Whenever a project's metadata or narrative changes in `project-spec.md` and needs to reach the site. This is the single publish path for new work. |

### Dataset synchronization

| Capability | What it does | When to use |
|---|---|---|
| **Sync production → local** | Exports the production dataset and imports it into the local dev dataset with `--replace`. Overwrites local entirely. | Pulling the latest published content down into local development. |
| **Sync local → production** | Exports the local dev dataset and imports it into production with `--replace`. **Destructive** — overwrites the entire production dataset. | Promoting development content to production, or "deploying" the whole portfolio. This is dataset-level and distinct from `publish_project`. |

### Indexing

| Capability | What it does | When to use |
|---|---|---|
| **Reindex content** | Rebuilds the semantic search index (Qdrant) from current Sanity content. It is **transactional**: it builds a temp collection, validates it, atomically promotes the production via aliases, then cleans up — production search never goes down. | After any successful content mutation (`create_project`, `update_project`, `publish_project`, `unpublish_project`, `delete_project`) so vector search reflects the latest state. The agent calls this automatically after mutations. |

### Spec-driven creation (`<path> add project considering this spec`)

| Capability | What it does | When to use |
|---|---|---|
| **Parse a spec file** | Deterministically parses a **canonical** `project-spec.md` (YAML frontmatter metadata + Markdown body). Rejects non-`.md`, oversized specs, and legacy bullet grammar. Returns `{format, fields, body_md, sections, body_sha256, warnings}`. | The parsing/preprocessing step of spec-driven creation (normally invoked internally). |
| **Describe project schema** | Discovers the live schema (cached; auto-refreshes when the schema file changes). | Normally invoked internally, but exposed for inspecting the current writable fields. |
| **Create project from spec** | Orchestrates parse → schema → deterministic map/validate → (1 LLM self-repair retry if validation fails) → **stages** a proposed payload. **Does not write to Sanity**; it returns the proposal for human confirmation. | Creating a project from a spec file with full transparency and an audit trail. |
| **Confirm pending create** | After the user replies `yes`, writes the staged project to Sanity and an audit record to `.agents/`. | Confirming a staged spec-driven create. |
| **Cancel pending create** | Discards the staged payload without touching Sanity. | Abandoning a staged spec-driven create. |

---

## 2. Expected project structure

The portfolio is built around one canonical spec file per project that is the
source of truth for **both** the project's metadata and its narrative.

```
projects/
└── <slug>/                    # one directory per project (lowercase URL-safe slug)
    ├── project-spec.md        # THE canonical authoring file
    └── images/                # optional image assets referenced by the spec
        └── architecture.png
```

- `project-spec.md` is a single file: YAML frontmatter (metadata) + a Markdown
  body (narrative). Nothing else is required.
- This is a **convention**: the spec can live anywhere readable by the agent.
  The full authoring rules (frontmatter, body syntax, serializer behavior, block
  patterns, image conventions, headings/anchors) are documented in the next
  section and in [`spec-format.md`](./spec-format.md).
- There is no `docs/` directory channel anymore — that format was removed.

---

## 3. Writing a project spec

This section teaches you how to author the canonical spec that the Publishing
Agent publishes via `publish_project_spec`. The agent never *writes* this
narrative; it **serializes** what you author, deterministically, into the
project's Portable Text `content`.

### 3.1 The spec file

```markdown
---
schema_version: 1
type: project
slug: candidate-ranking-system
title: Candidate Ranking System
shortSummary: Rank 100K+ candidate profiles against a job description.
technologies:
  - PyTorch
keyMetrics:
  - "Ranked 100K+ profiles in minutes"
githubUrl: https://github.com/…
coverImage: /images/cover.png
---

## Why I built it {#why-i-built-it}

…
```

- The frontmatter is machine metadata; its keys are exactly the Sanity `project`
  schema field names (`shortSummary`, `githubUrl`, `keyMetrics`, `coverImage`,
  …).
- `schema_version: 1` and `type: project` are required — they mark the file as
  canonical. Files without them are rejected as no-longer-supported legacy
  bullet specs.
- `title` contains the human-readable project name; `slug` is lowercase and
  URL-safe.
- Absent fields are omitted (never empty strings). Unknown keys are surfaced as
  warnings.
- The Markdown body below the frontmatter is the narrative; `##` headings
  become published sections.

### 3.2 Supported body Markdown

The serializer (`lib/content/markdown-to-pt.ts`) maps Markdown to the Portable
Text block palette:

- **Headings** — rendered as `h2`–`h5` depending on heading depth. A trailing
  `{#id}` marker sets the published anchor; otherwise the anchor derives from
  `generateHeadingId()`.
- **Prose** — paragraphs with inline **bold**, *italic*, `` `code` ``,
  `[links](...)`, and ~~strikethrough~~.
- **Lists** — bullet and ordered lists become blocks with `listItem` set
  (`bullet` / `number`).
- **Code blocks** — fenced ```…``` / `~~~…~~~` (with a language) become
  `documentationCodeBlock`s; the `language` is set from the fence.
- **Tables** — GitHub-flavor tables become `documentationTable`s.
- **Blockquote** — `>` lines become `documentationCallout`s (see 3.3).
- **Images** — `![alt](/absolute/path.png)` become `documentationImage`s
  (see 3.4).
- **Mermaid diagrams**, **challenge cards**, and **FAQ items** — special block
  patterns described in 3.3.

The serializer is **schema-free**: it needs no knowledge of "which sections
exist". Any heading or new storytelling section renders to blocks, so you are
free to add sections beyond any recommended list.

### 3.3 Special block patterns

#### Challenge Cards (`challengeCard`)

A paragraph that opens with `**Problem:** …`, optionally continues with
`**Solution:** …`, and (typically) ends with `**Outcome:** …` becomes a
`challengeCard`:

```markdown
**Problem:** The golden gate parser choked on 200 MB files.
**Solution:** A streaming chunked reader with a bounded buffer.
**Outcome:** Steady ~40% memory reduction on the largest inputs.
```

The labels must be exactly `problem` / `solution` / `outcome` (case-insensitive,
trailing colon and spaces stripped). Labels may be separated by **soft line
breaks (no blank line)** — remark joins them into one paragraph, which the
serializer splits back into segments. `solution` and `outcome` are optional; a
floating `outcome` or `solution` label finalizes the current card. A challenge
card is flushed automatically when the next non-label block begins.

#### FAQ items (`faqItem`)

A `**Q:** …` / `**A:** …` pair becomes an `faqItem`:

```markdown
**Q:** Do I need Ollama running to chat?
**A:** Yes, the agent chats against a local Ollama instance.
```

`A` must follow the pending `Q` (soft line break is fine). An `A` with no
pending `Q` produces an item with an empty question.

#### Callouts (`documentationCallout`)

A blockquote (`>` lines) becomes a callout. Its `variant` is inferred from
keywords in the text:

| Keyword | Variant |
|---|---|
| `limitation` | `limitation` |
| `lesson` | `lesson` |
| `future` / `roadmap` / `upcoming` | `future` |
| `form` / `stay` | `info` |

A leading `**Label:**` in the callout becomes its `title`.

#### Mermaid diagrams (`documentationMermaidDiagram`)

A fenced block whose language is `mermaid` becomes a diagram:

```mermaid
graph TD;
  A-->B;
```

#### Hard caps & validation

- Individual spec file: **30,000 chars** (`SPEC_MAX_CHARS`).
- Serializer input per document: **60,000 chars**.
- **Unbalanced code fences** and **non-absolute image paths** are detected
  during structural validation and abort with clear errors — nothing partial is
  written.
- An empty body serializes to zero blocks; the `content` patch is skipped
  (metadata-only project).

### 3.4 Image conventions

Images referenced in the body or frontmatter must use **absolute paths**
(start with `/`), resolved against the spec's directory:

```markdown
![System architecture](/images/architecture.png)
```

Rules:

- **Alt text is required** — the schema requires it. An image with no alt text
  is reported as an error.
- The path must be **absolute** (start with `/`). Relative paths are rejected
  during structural validation.
- The resolved file is uploaded to Sanity as part of publishing; the block
  stores the uploaded asset reference under `documentationImage.image`.
- Non-`md` assets (`.png`, `.webp`, `.jpg`, `.jpeg`, `.gif`, `.svg`) may sit
  anywhere the spec's directory can resolve them. A **missing file is
  best-effort** — a warning is logged and that image is skipped rather than
  failing the whole publish; always verify that images resolved after
  publishing.

For **metadata** images (`coverImage`, `screenshots`, `beforeAfterComparisons`),
paths also resolve against the spec's directory — prefer absolute paths.

### 3.5 Headings & anchors

Heading text and anchor ids (`#<heading>` for deep links, chat citations, and
search results) come from an explicit `{#id}` marker when present, otherwise
from the shared `generateHeadingId()` — so the project-page renderer, doc-page
TOC, chunker, and serializer all agree.

Blocks:

- `#foo` / `{#foo}` markers: `## Results {#results}` → anchor `#results`.
- Fallback slugification: lowercase → strip to `[a-z0-9]` runs joined by `-` →
  trim leading / trailing `-`. Examples: `Why I Built It` → `#why-it-built-it`,
  `Results: 40%` → `#results-40`. A heading with no slugifiable characters
  falls back to `section`. Duplicates receive stable numeric suffixes
  (`-2`, `-3`, …) **for fallback ids only**.

Recommendation: give each `##` section an explicit stable `{#id}` so deep links
and chat citations survive heading rewording.

---

## 4. Publishing workflow

A complete "new project" publication, end to end:

1. **Author the canonical spec.**
   - Write `projects/<slug>/project-spec.md` with frontmatter metadata and the
     Markdown body (see section 3 and `docs/spec-format.md`). This single file
     holds everything the project needs.

2. **Publish the complete project.**
   - Ask the agent to publish the spec via `publish_project_spec(path,
     mode="create")`. The agent writes the metadata **and** serializes the body
     into `project.content` in one call — no separate docs step.
   - For a staged, reviewed create: point the agent at the spec file
     (`<path> create a project considering this spec`). The agent parses →
   discovers schema → maps → validates → **stages** a proposed payload and
   shows it to you. Reply `yes` to confirm and write the project (with an audit
   record).

3. **Verify results.**
   - Read the project back with `read_project(slug)` or `list_projects()` to
     confirm content and visibility. Confirm per the checklist in section 7.

4. **Rebuild the index.**
   - After any content mutation, ask the agent to `reindex_content()` (or
     confirm the agent did so automatically). This keeps the semantic search
     index transactionally in sync.

**What the agent does during each step:**

- **Publish spec** — strips frontmatter, serializes the body to Portable Text
  (a dry-run that aborts on serializer errors **before** any write), writes the
  metadata via create/update, then REPLACE `content` with stable content-hash
  keys (idempotent re-runs; empty body → content untouched).
- **Metadata-only update** — a true partial patch of only the provided fields.
- **Reindex** — runs the transactional blue/green index swap: builds a temporary
  collection, validates (count, dimensions, retrieval probe), atomically aliases
  it in as production, and drops the previous index.

---

## 5. Prompting guidelines

The agent accepts natural-language instructions and maps them to the correct
dedicated tool. Below are example prompts for each common task.

### Create / publish a new project from a canonical spec (recommended)

> /home/me/repos/foo/PORTFOLIO_NOTES.md create a project considering this spec

(The agent parses the spec, stages a proposal, shows field-by-field provenance,
and asks you to confirm before writing. Reply `confirm` to commit; describe a
change to re-stage; say `cancel` to discard.)

> Publish this project: projects/candidate-ranking-system/project-spec.md

(`publish_project_spec` create or update mode — metadata + narrative in one
call. This is the **recommended** path for new work.)

### Update an existing project’s narrative

> Update the Results section of warehouse-parcel-monitoring-system.

The agent edits the spec body and re-publishes via `publish_project_spec`
(update mode).

### Update metadata only

> Change the status of `warehouse-parcel-monitoring-system` to `completed`.

or

> Update the GitHub URL of `video-captioning-agent` to https://github.com/me/vca.

### Read an existing project

> Read the project `candidate-ranking-system`.

### List projects

> What projects do I have?

### Publish / unpublish

> Put `warehouse-parcel-monitoring-system` live.

or

> Hide the old YOLOX project.

### Fixed semantics ("corrected text")

> The approach section of `candidate-ranking-system` is wrong. Here’s the
> corrected text: …… Please update the spec body and republish.

### Rebuild the search index

> Rebuild the search index.

### Sync datasets

> Pull the latest production changes into my local dataset.

> Promote my local changes to production. / Deploy my portfolio content.

---

## 6. Best practices

- **Spec first.** Author `projects/<slug>/project-spec.md` before publishing
  anything. It is the single source of truth for the project’s story.
- **Keep Markdown the source of truth.** Never edit `project.content` by hand in
  Studio — it is a derived, overwritten-on-publish representation. Edit the spec
  and re-run `publish_project_spec`.
- **Update metadata when** structured fields change: status, title, summary,
  technologies, URLs, order, featured, images — all in the spec frontmatter.
- **Update narrative in the spec body** for long-form changes: approach,
  architecture, results, decisions, challenges, future work.
- **Recommended publishing order for a brand-new project:**
  1. Author the canonical spec.
  2. `publish_project_spec` create mode (or the staged create flow) — creates
     the project with content.
  3. Publish it (make visible) if not already live.
  4. Rebuild the search index.
- **Use stable `{#id}` anchors.** Never hand-author fragment anchors fallback
  ids; explicit ids keep deep links and citations stable across rewording.
- **Image management.** Reference images with absolute paths. Always set
  meaningful alt text (required). Keep image files where the spec's directory
  can resolve them — a missing file logs a warning and is skipped rather than
  failing the publish.
- **Verify before moving on.** Check the output of each operation and confirm
  with `read_project` / `list_projects` per section 8.

---

## 7. Limitations

- **Narrative comes from the spec only.** Long-form story content is authored in
  the spec body and published via `publish_project_spec`. It is not authored
  through `update_project`.
- **Metadata vs. narrative is a single publish.** `publish_project_spec` handles
  both; `update_project` / `create_project` write metadata only and never touch
  `content`.
- **A project must exist to receive docs.** `publish_project_spec` update mode
  requires an already-existing project matching `slug` (create mode creates it).
- **One level of structured content from labels.** `Problem: / Solution: /
  Outcome:` cards and `Q: / A:` FAQ patterns are recognized only as labeled
  paragraphs. Arbitrary nested structures are not auto-mapped into cards.
- **`beforeAfterComparisons` isn’t writable by the generic path.** It is an array
  of objects; the writable field set only maps scalar/string-array/image-array
  fields. Use Sanity Studio for it.
- **Image uploads are best-effort.** A missing image file logs a warning and the
  image is skipped; the publish as a whole still succeeds. Always verify that
  published images resolved.
- **`published` defaults to `true`** for spec-driven creates. Unpublish if you
  do not want it live yet.
- **Slug uniqueness is enforced.** A create fails loudly if the slug exists;
  the collision suggests `update_project` or spec `update` mode instead.
- **Image paths in spec files must be absolute.** Relative paths are rejected
  (the parser flags them and presents the warning; a field given with a
  non-absolute path may be dropped).
- **Size caps.** Spec files: `SPEC_MAX_CHARS` (default 30,000); serializer
  input: 60,000 chars per document. Exceeding a cap aborts rather than silently
  truncating.
- **Dataset sync is destructive and whole-dataset.** `sync_local_to_production`
  replaces the entire production dataset with `--replace`. Reindex should follow
  a dataset promote.
- **Single-writer indexing.** Reindex uses a lock file ensuring one transaction
  at a time; it fits a single-agent/CLI workflow but is not a real lease
  mechanism for concurrent API-driven publishing.
- **No `projectDocumentationPage` generation.** Only the `project` overview
  document (its `content`) is produced here; full per-project doc pages are
  separate.
- **Local Ollama required.** The agent runs against a local Ollama instance
  (default `http://localhost:11434`) unless a cloud provider is configured; it
  must be running and have the configured model pulled.
- **Env configuration is manual.** Sanity tokens and project id must be in
  `.env.local` (read only via the agent's scripts). Without a write token,
  mutation calls fail.

---

## 8. Verification checklist

Run through this after any publishing work:

- [ ] **Publish spec succeeded** with no serializer errors (no unbalanced code
      fence, no relative image, no missing-alt errors), and the agent printed a
      project id.
- [ ] **Metadata is correct** — `read_project(slug)` returns the expected
      `title`, `status`, `shortSummary`, technologies, URLs, metrics, and
      `published` value.
- [ ] **Narrative is present** — `read_project(slug)` returns a non-empty
      `content` array matching the number of sections you authored.
- [ ] **Image alt/asset resolution** — no "Image not found" warnings in the
      output; cover/screenshot references resolve to real asset ids.
- [ ] **Visibility** — `list_projects()` shows the intended `published` state
      (visible/hidden) for the target project.
- [ ] **Index synced** — the agent ran `reindex_content()` after your mutations
      or you triggered it; the report shows a successful reindex.
- [ ] **Delete (if you deleted)** — project no longer appears in
      `list_projects()`.
- [ ] **Spec creates** — an audit record exists under
      `.agents/spec-<slug>-<timestamp>.json` with the mapped payload and
      provenance.
- [ ] **Code health** (if you touched repo code/files): `npm run lint`,
      `npm run typecheck`, and `npm run build` all pass.

---

## References

- Canonical format: [`spec-format.md`](./spec-format.md), `docs/spec-format.md`.
- Implementation: `agent/publish_agent.py`, `scripts/publish-tool.ts`,
  `scripts/publish-project-spec.ts`, `scripts/sync-dataset.ts`,
  `scripts/index-content.ts`.
- Schema source of truth: `sanity/schemaTypes/project.ts`.
- Narrative serializer: `lib/content/markdown-to-pt.ts`,
  `lib/content/frontmatter.ts`.