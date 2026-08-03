# Publishing Agent — User Guide

This guide explains how to work with the Portfolio **Publishing Agent**, a
natural-language assistant that manages projects in the Sanity CMS portfolio
and keeps the site, its documentation, and its semantic search index in sync.

The agent is a **schema-aware mapper, never an author**. It copies your content
verbatim into the matching Sanity fields, coerces types, and flags ambiguity. It
does not rewrite, summarize, or invent content. Markdown documents you author in
the repository are the source of truth for a project's narrative; the agent
publishes a derived copy of them into Sanity.

---

## 1. Publishing Agent capabilities

The agent exposes a set of dedicated operations. Every operation is a distinct
tool — the agent must not substitute one for another.

### Read-only / inspection

| Capability | What it does | When to use |
|---|---|---|
| **List projects** | Lists all projects, optionally filtered by title. Returns `title`, `slug`, and `published` visibility for each. | Finding a project's slug, checking visibility, scanning what exists, or disambiguating a name. |
| **Read a project** | Returns a single project's full current data from Sanity by `slug` — metadata, alt texts, and its published Portable Text content. | Reviewing a project's current state before an update, or verifying what is actually stored. |
| **Read a file from disk** | Reads the full contents of any file on disk. | Inspecting spec files, Markdown docs, or other repo files the user points at. |
| **Find Markdown** | Recursively lists all `.md` files inside a directory. | Locating a project's documentation directory. |
| **List a directory** | Lists entries (files and subdirectories) in a directory. | Exploring the repository layout. |
| **Describe project schema** | Discovers the live `project` document schema from `sanity/schemaTypes/project.ts` (the single source of truth). | Understanding which fields exist, which are required, and their types before authoring a spec. |

### Project lifecycle (mutation)

| Capability | What it does | When to use |
|---|---|---|
| **Create a project** | Creates a brand-new project. Fails loudly if the slug already exists. Requires `title` and `slug`; all other metadata (summary, images, technologies, metrics, URLs, featured, display order) is optional. | Bringing a brand-new project into the portfolio for the first time. |
| **Update a project** | True **partial update** of an **existing** project. Only the fields you include are changed; everything else is preserved. Fails if the slug is not found. | Editing any metadata field on an existing project: summary, status, technologies, URLs, images, order, featured. |
| **Publish a project** | Sets `published = true`, making one project visible on the public portfolio. A pure visibility toggle. | Making an existing (drafted or already-hidden) project live. |
| **Unpublish a project** | Sets `published = false`, hiding one project from the public portfolio. | Taking an existing project down (e.g. WIP, or no longer wanted publicly). |
| **Delete a project** | Permanently removes a project and all of its documentation pages from Sanity. | Irreversible removal of a project and its docs. |

### Narrative documentation

| Capability | What it does | When to use |
|---|---|---|
| **Publish documentation** (`publish_docs`) | Deterministically serializes **every** Markdown document in a project's `docs/` directory into Portable Text and writes it to `project.content` as a **replace** (stable keys → idempotent re-runs). Metadata is never touched. | Whenever a project's narrative is authored/written-updated in Markdown and needs to reach the site. Call it after writing new docs files or editing existing ones. |

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
| **Parse a spec file** | Deterministically extracts fields from a rigid Markdown spec grammar (`- **field**: value`). Rejects non-`.md` files and oversized specs. | Creates the rules / preprocessing step of spec-driven creation (normally invoked internally). |
| **Describe project schema** | Discovers the live schema (cached; auto-refreshes when the schema file changes). | Normally invoked internally, but exposed for inspecting the current writable fields. |
| **Create project from spec** | Orchestrates parse → schema → deterministic map/validate → (optional) one LLM self-repair retry → **stages** a proposed payload. **Does not write to Sanity**; it returns the proposal for human confirmation. | Creating a project from a spec file with full transparency and an audit trail. |
| **Confirm pending create** | After the user replies `yes`, writes the staged project to Sanity and an audit record to `.agents/`. | Confirming a staged spec-driven create. |
| **Cancel pending create** | Discards the staged payload without touching Sanity. | Abandoning a staged spec-driven create. |

---

## 2. Expected project structure

The portfolio is built around per-project Markdown documentation that is the
source of truth for a project's narrative.

**There is no enforced documentation location.** The documentation directory is
passed to `publish_docs(slug, <docs_dir>)` as an explicit argument. It may live
anywhere on the local filesystem the agent can read — inside this repo
(`projects/<slug>/docs/`), outside it, in a temp/scratch directory, or in an
unrelated project. Only the **contents and structure** of the directory matter,
never where it happens to live.

For a conventional repo-backed portfolio the narrative files are usually kept in
`projects/<slug>/docs/`:

```
projects/
└── <slug>/                       # one directory per project (lowercase URL-safe slug)
    └── docs/                     # conventional docs location (not required)
        ├── overview.md           #     recommended: why / problem / solution
        ├── architecture.md       #     recommended: system diagram
        ├── engineering-decisions.md
        ├── challenges.md         #     publishes as challenge cards
        ├── results.md            #     recommended: measurable outcomes
        ├── demonstrates.md
        ├── examples.md
        ├── lessons-and-limitations.md
        ├── future-improvements.md
        ├── timeline.md
        ├── faq.md
        └── ...
        └── *.png / *.webp / *.jpg / *.gif / *.svg   # assets referenced by docs
```

This layout is a *convention and a recommendation*, not a constraint. You may
keep the docs under `projects/<slug>/`, a standalone `docs/` sibling, or any
other path — just pass that directory to `publish_docs` and its contents will be
consumed identically. The full authoring rules (front matter, syntax, serializer
behavior, block patterns, image conventions, headings/anchors) are documented in
the next section, **Writing Project Documentation**.

### Required / optional files

| File / dir | Status | Notes |
|---|---|---|
| Documentation directory | Required at publish time | Passed as the `<docs_dir>` argument to `publish_docs`; must contain at least one `.md`. |
| One `.md` per engineering document | Optional as individual files, but the passed directory must contain at least one `.md` | Any document, heading, or section renders — the serializer is schema-free (see below). |
| Non-`md` asset files (`png`/`webp`/`jpg`/`gif`/`svg`) | Optional | Contained anywhere inside the docs dir and referenced by docs; uploaded on publish. |
| `README.md` | **Skipped** | Automatically ignored by doc discovery (as are dot-files). |

---

## 3. Writing Project Documentation

This section teaches you how to author documentation that the Publishing Agent
can consume via `publish_docs`. The agent never *writes* this narrative; it
**serializes** what you author, deterministically, into the project's Portable
Text `content`. Follow the conventions below and any docs directory you point at
will publish cleanly.

### 3.1 The documentation directory (location is free)

`publish_docs(slug, <docs_dir>)` receives the documentation directory as an
explicit argument. Discovery does **not** assume any path or naming convention:

- The directory may be anywhere on the local filesystem the agent can read.
- Discovery recurses through subdirectories and picks up every `.md` file.
- Two files are skipped during discovery: `README.md` and any file whose name
  starts with a dot (`.`).
- Every other `.md` becomes an *engineering document* (a chapter, never a schema
  field). The relative path inside the directory is used for ordering/headers
  only; the directory's own location is irrelevant.

### 3.2 Document ordering

Documents are sequenced deterministically:

1. By the `order` front-matter value (if present).
2. Otherwise by a canonical filename order — `overview.md`, `architecture.md`,
   `engineering-decisions.md`, `challenges.md`, `results.md`, `demonstrates.md`,
   `examples.md`, `lessons-and-limitations.md`, `future-improvements.md`,
   `timeline.md`, `faq.md`.
3. Any remaining files sort alphabetically after them.

Within a directory, files with equal `order` are ordered by filename.

### 3.3 Front matter

A document may open with YAML front matter delimited by `---` lines:

```markdown
---
order: 2
title: Why I Built It
---

## Body starts here
```

Supported keys:

- `order` — an integer controlling the document's position in the sequence
  (see 3.2). Accepts a numeric or numeric-string value.
- `title` — used as a **fallback heading** when the body has no Markdown
  heading.

The document's heading resolves as: `title` front matter → first heading in the
body → the filename (prettified: `-`/`_` become spaces, words capitalized).

**Malformed front matter is rejected loudly.** The body must be a YAML mapping;
any parse error or non-mapping value aborts the publish with a clear error.

### 3.4 Supported Markdown syntax

The serializer (`lib/content/markdown-to-pt.ts`) maps Markdown to the Portable
Text block palette:

- **Headings** — rendered as `h2`–`h5` depending on the document's heading depth.
- **Prose** — paragraphs with inline **bold**, *italic*, `` `code` ``,
  `[links](...)`, and ~~strikethrough~~.
- **Lists** — bullet and ordered lists become blocks with `listItem` set
  (`bullet` / `number`).
- **Code blocks** — fenced ```…``` / `~~~…~~~` (with a language) become
  `documentationCodeBlock`s; the `language` is set from the fence.
- **Tables** — GitHub-flavor tables become `documentationTable`s.
- **Blockquotes** — `>` lines become `documentationCallout`s (see 3.5).
- **Images** — `![alt](/absolute/path.png)` become `documentationImage`s
  (see 3.6).
- **Mermaid diagrams**, **challenge cards**, and **FAQ items** — special block
  patterns described in 3.5.

The serializer is **schema-free**: it needs no knowledge of "which sections
exist". Any heading, document, or new storytelling section renders to blocks, so
you are free to add documents beyond any recommended list.

### 3.5 Special block patterns

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
| `warning` / `caution` | `warning` |
| `success` / `complete` | `success` |
| (none) | `info` |

A leading `**Label:**` in the callout becomes its `title`.

#### Mermaid diagrams (`documentationMermaidDiagram`)

A fenced block whose language is `mermaid` becomes a diagram:

````markdown
```mermaid
graph TD;
  A-->B;
```
````

#### Hard caps & validation

- Individual Markdown file: **30,000 chars**.
- Whole docs directory (sum of bodies): **200,000 chars**.
- Serializer input per document: **60,000 chars**.
- **Unbalanced code fences** and **non-absolute image paths** are detected during
  structural validation and abort with clear errors (nothing partial is written).

Exceeding any cap aborts the publish rather than silently truncating.

### 3.6 Image conventions

Images referenced from doc Markdown must use **absolute paths owned by the
serializer/uploader resolve path**; the serializer requires a repo-root-absolute
path so the file can be resolved and uploaded:

```markdown
![System architecture](/architecture-diagram.png)
```

Rules:

- **Alt text is required** — the schema requires it. An image with no alt text
  is reported as an error.
- The path must be **absolute** (start with `/`). Relative paths are rejected
  during structural validation.
- The resolved file is uploaded to Sanity as part of `publish_docs`; the block
  stores the uploaded asset reference under `documentationImage.image`.
- Non-`md` assets (`.png`, `.webp`, `.jpg`, `.jpeg`, `.gif`, `.svg`) may sit
  anywhere inside the docs directory. A **missing file is best-effort**: it logs
  a warning and that image is skipped rather than failing the whole publish —
  always verify that images resolved after publishing.

For **metadata** images (`coverImage`, `screenshots`, `beforeAfterComparisons`),
paths resolve relative to the project/Markdown source directory (e.g.
`docs/covers/cover.png`). For consistency, prefer absolute paths where the
tooling supports them.

### 3.7 Headings & anchors

Heading text and anchor ids (`#<heading>` for deep links, chat citations, and
search results) are generated by a single shared `generateHeadingId()` — so the
project-page renderer, doc-page TOC, chunker, and the serializer all agree.

Slugification: lowercase → strip to `[a-z0-9]` runs joined by `-` → trim leading
/trailing `-`. Examples: `Why I Built It` → `#why-i-built-it`,
`Results: 40% faster` → `#results-40-faster`. A heading with no slugifiable
characters falls back to `section`. Duplicates receive stable numeric suffixes
(`-2`, `-3`, …).

Never hand-author anchors; rely on `generateHeadingId` so deep links stay stable
across renderers.

---

## 4. Publishing workflow

A complete "new project" publication, end to end:

1. **Author the metadata specification.**
   - Draft the project's metadata. You can either provide it inline to the agent, or
write it under a spec file that follows the labeled-bullet grammar (see
      section 5). Authoring a spec is recommended for reproducible, audited creates.

2. **Create the project.**
   - Metadata path: ask the agent to create the project. It validates `title` and
     `slug`, uploads any images, and fails loudly if the slug already exists.
   - Spec path: point the agent at the spec file (`<path> create a project
     considering this spec`). The agent parses → discovers schema → maps →
     validates → **stages** a proposed payload and shows it to you for review.
     Reply `yes` to confirm and write the project (plus an audit record).

3. **Write the narrative documentation.**
   - Author the Markdown narrative in **any** docs directory (e.g.
     `projects/<slug>/docs/` — any on-disk location is fine). Follow the
     conventions in section 3 and the suggested file names/structure from
     section 2.

4. **Publish the documentation.**
   - Ask the agent to publish the docs, **passing your docs directory as the
     argument**: `publish_docs(slug, <docs_dir>)` (e.g.
     `publish_docs('candidate-ranking-system', 'projects/candidate-ranking-system/docs')`).
     The agent serializes **all** `.md` files deterministically into
     `project.content` as a replace, uploads referenced images, and never
     touches metadata.

5. **Publish metadata (if needed).**
   - If the project should be visible immediately, ensure `published = true`
     (the default on create). For drafted projects, publish later via
     `publish_project(slug)`.

6. **Verify results.**
   - Read the project back with `read_project(slug)` or `list_projects()` to
     confirm content and visibility. Confirm per the checklist in section 8.

7. **Rebuild the index.**
   - After any content mutation, ask the agent to `reindex_content()` (or confirm
     the agent did so automatically). This keeps the semantic search index
     transactionally in sync with the new content.

**What the agent does during each step:**

- **Create** — resolves images, checks the slug, writes the `project` document,
  and prints a confirmation with the new project id.
- **Publish docs** — discovers the `.md` files, orders them, serializes to Portable
  Text, uploads images, updates `project.content`. The serialization is a stored
  **replace** with stable content-hash keys, so re-runs are idempotent.
- **Metadata update** — a true partial patch of only the provided fields.
- **Reindex** — runs the transactional blue/green index swap: builds a temporary
  collection, validates (count, dimensions, retrieval probe), atomically aliases it
  in as production, and drops the previous index. Production search stays up the whole time.

---

## 5. Prompting guidelines

The agent accepts natural-language instructions and maps them to the correct
dedicated tool. Below are example prompts for each common task. The agent's
system prompt includes an explicit intent→operation mapping, so phrase your
request like these.

### Create a new project (metadata path)

> Create a new project: **Video Captioning Agent**. Slug `video-captioning-agent`.
> Short summary: A hackathon project that watches lecture videos and produces timestamps, captions, and summaries. Technologies: Python, OpenCV, Docker. GitHub: https://github.com/… Metrics: "27 commits covering every pipeline stage".

### Create a new project from a spec (recommended for reproducibility)

> /home/me/repos/foo/PORTFOLIO_NOTES.md create a project considering this spec

(The agent parses the spec, stages a proposal, shows you field-by-field provenance,
and asks you to confirm before writing. Reply `yes` to commit; describe a change or
say `cancel` to discard.)

### Update documentation (narrative)

> Update the results section of warehouse-parcel-monitoring-system.

or

> Publish the docs for `candidate-ranking-system` from `projects/candidate-ranking-system/docs`.

### Create documentation only (no metadata change)

> Just publish the docs for `candidate-ranking-system`.

### Update metadata only

> Change the status of `warehouse-parcel-monitoring-system` to `completed`.

or

> Update the GitHub URL of `video-captioning-agent` to https://github.com/me/vca.

### Read an existing project

> Read the project `candidate-ranking-system`.

### List projects

> What projects do I have?

### Publish / unpublish a project

> Put `warehouse-parcel-monitoring-system` live.

or

> Hide `the old YOLOX project`.

### Correct documentation (fix a mistake)

> The approach section of `candidate-ranking-system` is wrong. Here's the corrected text: …… Please update the docs file and republish.

### Add new sections

> Add a "Demonstration Video" section to the `video-captioning-agent` docs and publish it.

### Update images

> Change the cover image of `candidate-ranking-system` to `/architecture-diagram.png`.

### Rebuild the search index

> Rebuild the search index.

### Sync datasets

> Pull the latest production changes into my local dataset.

> Promote my local changes to production. / Deploy my portfolio content.

---

## 6. Best practices

- **Documentation first.** Author the narrative in Markdown in the repo before
  you publish anything. The docs directory you pass to `publish_docs` is the
  single source of truth for a project's story; the agent only carries a
  deterministic copy into Sanity.
- **Keep Markdown the source of truth.** Never edit `project.content` by hand in
  Studio — the schema description itself marks it as a derived field and publishes
  docs will overwrite it. Edit the Markdown and re-run `publish_docs`.
- **Update metadata when** the structured fields change: status, title, summary,
  technologies, URLs, display order, featured flag, or images. These do **not**
  live in Markdown — use `update_publish` / `update_project`.
- **Update documentation when** the long-form narrative changes: approach,
  architecture, results, decisions, challenges, future work. These live in
  Markdown — edit and re-run `publish_docs`.
- **Keep the two concerns separate.** The agent will not write narrative via
  `update_project`, and `publish_docs` will never touch metadata. Plan your
  requests accordingly.
- **Image management.** Reference images in docs with absolute repo-root paths.
  For metadata images use paths relative to the project/Markdown directory. Always
  set meaningful alt text (it is required for doc images). Keep image files inside
  the docs directory you publish so the uploader can find them — a missing file
  logs a warning and that image is skipped rather than failing the publish.
- **Recommended publishing order.** For a brand-new project:
  1. Author the spec / gather metadata.
  2. Create the project (and confirm a spec-based create).
  3. Write the Markdown narrative in your docs directory.
  4. `publish_docs` → put the narrative in.
  5. Publish the project (make it visible) if you want it live.
  6. `reindex_content`.
  Create the skeleton first, then publish narration, then flip visibility, then alias-sync the index.
- **Verify before moving on.** Check the output of each agent operation and
  confirm with `read_project` / `list_projects` per section 8.

---

## 7. Limitations

The following are current known limitations; know them before relying on the agent.

- **Narrative = docs only.** Long-form story content is authored in Markdown and
  published via `publish_docs`. There is no metadata field for long-form narrative.
  Narrative cannot be authored through `update_project`.
- **Metadata vs. narrative separation is strict.** `create_project`/`update_project`
  will not write to `content`; `publish_docs` does not write any metadata.
- **Documentation-only updates to a project with no `docs/` directory will fail.**
  `publish_docs` requires at least one `.md` file in the directory, and throws if
  the directory is empty or missing.
- **A project must exist to receive docs.** `publish_docs(slug, …)` requires an
  already-created project matching `slug`.
- **Only one level of structured content from labels.** The `Problem: / Solution: /
  Outcome:` card and `Q: / A:` FAQ patterns are recognized only as labeled paragraphs
  (bold labels, optionally separated by soft line-breaks). Arbitrary nested structures
  are not auto-mapped into cards.
- **Structured comparison objects aren't writable** by the metadata path.
  - `beforeAfterComparisons` is an array of objects; the agent's writable field set
    only maps scalar/string-array/image-array fields, so this field is *not*
    populated via create/update. Use Sanity Studio for it.
- **Image uploads are best-effort.** A missing image file logs a warning and the
  image is skipped (the publish still excludes as a whole). Always `verify` that
  published images resolved.
- **`published` defaults to `true`** for spec-driven creates, matching the metadata
  create behavior. Unpublish if you do not want it live yet.
- **Slug uniqueness is enforced.** A create fails loudly if the slug exists;
  the collision suggests `update_project` instead.
- **Image paths in spec files must be absolute.** Relative paths are rejected
  (the parser flags them and presents the warning; a field given with a non-absolute
  path may be dropped).
- **Size caps.** Individual specs are capped at `SPEC_MAX_CHARS` (default 30,000);
  each Markdown file at 30,000 chars and a docs directory at 200,000 chars total;
  the serializer at 60,000 chars per document. Exceeding a cap aborts rather than
  silently truncating.
- **Dataset sync is destructive and whole-dataset.** `sync_local_to_production`
  replaces the entire production dataset with `--replace`. It is not the same as
  publish/unpublish one project. Reindex should follow a dataset promote so search
  reflects it.
- **Single-writer indexing.** Reindex uses a lock file ensuring one transaction at
  a time; it fits a single-agent/CLI workflow but is not a real lease mechanism for
  concurrent API-driven publishing.
- **No `projectDocumentationPage` generation.** Only the `project` overview document
  (its `content`) is produced here; full per-project doc pages are separate.
- **Local Ollama required.** The agent runs against a local Ollama instance
  (default `http://localhost:11434`). It must be running and have the configured model
  (`qwen3:4b` by default) pulled.
- **Env configuration is manual.** Sanity tokens and project id must be in `.env.local`
  (agent reads `.env.local` only when explicitly directed by its scripts). Without
  a write token, mutation calls fail.

---

## 8. Verification checklist

Run through this after any publishing work:

- [ ] **Create succeeded** with no "slug already exists" or validation error, and
      the agent printed a project id.
- [ ] **Docs published** — `publish_docs` printed the count of documents → blocks,
      with no serializer errors (no unbalanced-code-fence, no relative/error image,
      no missing-alt errors).
- [ ] **Metadata is correct** — `read_project(slug)` returns the expected `title`,
      `status`, `shortSummary`, technology tags, URLs, metrics, and `published`
      value.
- [ ] **Narrative is present** — `read_project(slug)` returns a non-empty `content`
      array matching the number of sections you authored.
- [ ] **Image alt/asset resolution** — no "Image not found" warnings in the output;
      cover/screenshot reference resolve to real asset ids.
- [ ] **Visibility** — `list_projects()` shows the intended `published` state
      (visible/hidden) for the target project.
- [ ] **Index synced** — the agent either ran `reindex_content()` after your
      mutations or you triggered it; reindex output reported a successful validate &
      promote with matching counts.
- [ ] **Delete (if you deleted)** — project no longer appears in `list_projects()`.
- [ ] **Spec creates** — an audit record exists under `.agents/spec-<slug>-<timestamp>.json`
      with the mapped payload and provenance.
- [ ] **Code health** (if you touched repo code/files): `npm run lint`,
      `npm run typecheck`, and `npm run build` all pass.

---

## References

- Implementation: `agent/publish_agent.py`, `scripts/publish-tool.ts`,
  `scripts/publish-docs.ts`, `scripts/sync-dataset.ts`, `scripts/index-content.ts`.
- Schema source of truth: `sanity/schemaTypes/project.ts`.
- Narrative details: `lib/content/discover-docs.ts`, `lib/content/markdown-to-pt.ts`.