# AGENTS.md — Aditya More AI Portfolio

## Dev Commands (run in order for validation)

```bash
npm run lint
npm run typecheck
npm run build
```

- `npm run dev` — starts Next.js on `http://localhost:3000`
- `npm run sanity` — delegates to `sanity` CLI
- `npx sanity dataset import sanity/seed.ndjson production --replace` — seeds starter content

## Architecture

- **Next.js App Router** + **Sanity CMS** (embedded Studio at `/studio` via `sanity.config.ts`)
- Incremental Static Regeneration: `export const revalidate = 60` on all pages
- No custom backend — Sanity Content Lake is the only data source

## Key Files

| File | Purpose |
|------|---------|
| `sanity/schemaTypes/project.ts` | Project document schema (all fields) |
| `sanity/schemaTypes/projectDocumentationPage.ts` | Per-project doc pages (Portable Text body) |
| `sanity/types.ts` | TypeScript types matching Sanity documents |
| `sanity/queries.ts` | All GROQ queries + typed fetchers |
| `sanity/client.ts` | Public read client (CDN, published perspective) |
| `sanity/previewClient.ts` | Draft preview client (requires `SANITY_API_READ_TOKEN`) |
| `sanity/fallbackContent.ts` | Hardcoded fallback data when Sanity unconfigured |
| `sanity/env.ts` | Reads `NEXT_PUBLIC_SANITY_*` env vars |
| `lib/project-docs-source.ts` | fumadocs tree builder for doc page navigation |
| `.env.example` | All required env vars documented |

## Project Schema (layered storytelling approach)

Projects follow a progressive disclosure hierarchy. All text fields except `detailedContent` are `markdown` type (rendered via `<Markdown>` component). `detailedContent` is Portable Text (`block[]`).

Required fields on `project` document: `title`, `slug`.

Image fields (`coverImage`, `architectureImage`, `screenshots[]`, `beforeAfterComparisons[].beforeImage`, `beforeAfterComparisons[].afterImage`) are Sanity image type with hotspot and `alt` string field.

Visibility flag: `published` (boolean, default `true`) — controls whether the project appears on the public site. The agent's `publish_project` and `unpublish_project` tools toggle this field.

### Field order (storytelling hierarchy)

| Section | Fields | Audience |
|---------|--------|----------|
| **Hero** | `title`, `shortSummary`, `status`, `technologies`, `githubUrl`, `demoUrl`, `keyMetrics`, `coverImage` | All |
| **Why I Built It** | `whyIBuiltIt` — personal, engineering-driven motivation | All |
| **The Problem** | `theProblem` — what engineering problem existed | Recruiter+ |
| **The Solution** | `theSolution` — high-level system explanation | Recruiter+ |
| **System Architecture** | `architectureImage` — diagram + alt text | Recruiter+ |
| **Engineering Decisions** | `engineeringDecisions` — design decisions and rationale | Hiring Manager+ |
| **Interesting Challenges** | `interestingChallenges[]` — array of `{problem, solution, outcome}` objects | Hiring Manager+ |
| **Results** | `results` — measurable outcomes | All |
| **What This Demonstrates** | `whatThisDemonstrates` — engineering skills summary | Recruiter+ |

### Optional fields (when available)

`screenshots[]`, `demoVideo` (url), `beforeAfterComparisons[]` (array of `{beforeImage, afterImage, caption}`), `exampleInputsOutputs`, `lessonsLearned`, `limitations`, `futureImprovements`, `timeline`, `faq[]` (array of `{question, answer}`), `detailedContent` (Portable Text)

### Status values

`active`, `completed`, `archived`, `poc`, `in-development`

### Deprecated fields (hidden in Studio, may be removed)

`problemStatement`, `approach` — replaced by the storytelling fields above.

## Publishing Agent

A Python-based agent (`agent/publish_agent.py`) that manages the full project lifecycle via natural language.

### Setup

```bash
cd agent
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# Ensure .env.local has NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN set
```

### Usage

```bash
source agent/.venv/bin/activate
python3 agent/publish_agent.py
> Add this project: # My Project\n## Problem Statement\n...
> Update the results section of warehouse-parcel-monitoring-system
> Delete the old YOLOX project
> What projects do I have?
> Sync production to local.
> Deploy my portfolio content.
> /home/me/repos/foo/PORTFOLIO_NOTES.md add project considering this spec
```

### Spec-Driven Project Creation (`<path> add project considering this spec`)

Turns a Markdown specification into a populated `project` document. The agent is
a **schema-aware mapper, never an author**: it copies spec content verbatim into
matching Sanity fields, coerces types, flags uncertainty, and asks for
confirmation before writing. It does not rewrite, summarize, or invent content.

**Spec format** — every project field is a labeled bullet:

```markdown
### Project Fields

- **title**: Video Captioning Agent
- **slug**: `video-captioning-agent`
- **shortSummary**:
  A hackathon project that watches…
- **technologies**:
  - Python
  - OpenCV
  - Docker
- **keyMetrics**:
  - "27 commits covering every major pipeline stage"
- **githubUrl**: https://github.com/…
- **demoUrl**: Not live yet - …
- **featured**: `true`
- **displayOrder**: `0`
- **problemStatement**:
  The brief was to…
- **approach**: …
- **results**: …
- **coverImage**: Not set - …
- **screenshots**: Not set - …
- **limitations**: …
- **futureImprovements**: …
```

`Not set - …` / `Not live yet - …` markers normalize to absent (never empty
strings). Image paths MUST be absolute; relative paths are rejected.

## Workflow tools

| Tool | What it does |
|------|-------------|
| `parse_spec_file(path)` | Deterministic Markdown bullet parser → JSON `{fields, provenance, source_dir, warnings, spec_sha256}`. Rejects non-`.md`, oversized specs (> `SPEC_MAX_CHARS`, default 30000), and relative image paths. |
| `describe_project_schema()` | Discovers the live `project` schema from `sanity/schemaTypes/project.ts` (the single source of truth) by executing each validation function against a mock `Rule`. Cache is mtime-keyed and auto-refreshes when the schema changes. |
| `create_project_from_spec(spec_path)` | Orchestrator: parse → schema → deterministic map/validate → (1 LLM self-repair retry if validation fails) → stage `PENDING_CREATE` and return proposed payload + provenance for confirmation. Does NOT write to Sanity. |
| `confirm_pending_create()` | After the user replies `yes`: writes the staged project to Sanity (via `create_project`) and an audit record to `.agents/spec-<slug>-<timestamp>.json`. |
| `cancel_pending_create()` | Discards the staged payload. |

## Determinism stance

- **Happy path is fully deterministic.** Parse, schema discovery, type coercion,
  and validation are all deterministic and schema-driven (no LLM in the loop).
- **LLM is only a self-repair fallback.** When deterministic validation fails,
  `create_project_from_spec` makes ONE `with_structured_output` call constrained
  to the discovered-schema Pydantic model, then re-runs the SAME deterministic
  validator on its output. If it still fails, the request is surfaced to the
  user — nothing is written to Sanity.
- **`published` defaults to `true`** for spec-driven creates, matching the
  existing `create_project` behavior.
- **Collision policy:** if the slug already exists in Sanity, the create fails
  loudly; the agent suggests `update_project` instead.
- **No `projectDocumentationPage` generation** in v1 — only the `project`
  overview doc.

## Adding / renaming / requiring a Sanity field

Because the schema is discovered live: edit `sanity/schemaTypes/project.ts` (add
a field, mark it `Rule.required()`, etc.), and the agent picks it up on the next
`create_project_from_spec` call. No prompt, parser, or validation code changes
are required. The agent also no longer carries a hardcoded field list in
`scripts/publish-tool.ts` — non-image, non-meta fields are copied through
generically via `setGenericFields`, so newly added scalar/markdown/array-of-string
fields reach Sanity automatically.

### Dataset Synchronization

The agent can move an entire Sanity dataset between environments through natural language. No slugs are needed — these replace the whole dataset (`--replace`).

- **Production → Local** ("Pull the latest production changes", "Refresh my local dataset", "Update my local dataset from production") → `sync_production_to_local()` — overwrites local with production.
- **Local → Production** ("Promote development to production", "Publish my local changes to production", "Deploy my portfolio content") → `sync_local_to_production()` — overwrites production (destructive). Distinct from `publish_project()`, which toggles a single project's visibility.

### Architecture

```
agent/publish_agent.py   ← Python REPL with Ollama tool-calling
        ↓  (shells out)
scripts/{create-project,update-project,publish-project,unpublish-project,read-project,list-projects,delete-project,sync-dataset,describe-schema}.ts   ← thin TypeScript bridges
        ↓
scripts/publish-tool.ts   ← pure side-effect layer (uploads, Sanity mutations)
```

### Tool layer (TypeScript bridges — called by agent)

| Bridge | What it does |
|--------|-------------|
| `scripts/create-project.ts <json-file>` | Creates a new project (fails if slug exists) |
| `scripts/update-project.ts <json-file> <slug>` | Patches specific fields of an existing project (true partial update) |
| `scripts/publish-project.ts <slug>` | Sets `published = true` on a project |
| `scripts/unpublish-project.ts <slug>` | Sets `published = false` on a project |
| `scripts/read-project.ts <slug>` | Returns JSON of existing project data |
| `scripts/list-projects.ts [search]` | Lists projects, optionally filtered by title |
| `scripts/delete-project.ts <slug>` | Deletes project + documentation pages |
| `scripts/describe-schema.ts [project]` | Discovers the live `project` schema by executing each validation fn against a mock `Rule`; prints normalized JSON |  |
| `scripts/sync-dataset.ts <prod-to-local\|local-to-prod>` | Exports source dataset, imports into destination with `--replace` |

Bridges auto-load `.env.local` via `scripts/load-env.ts`. The local dev dataset name defaults to `local` and is overridable via `SANITY_LOCAL_DATASET`.

## Environment Files Policy

Agents and automated workflows MUST NOT read `.env.local` or any `.env*` file unless the user explicitly instructs them to. Never echo, log, or expose environment variable values in responses — they contain secrets (Sanity tokens, API keys).

## Langfuse Observability

- **Library:** `langfuse` (npm)
- **Initialization:** Singleton `Langfuse` client in `lib/agent/langfuse-tracer.ts`; enabled when both
  `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set. A `LangfuseTracer` instance is created
  per request inside the orchestrator.
- **Trace structure (one trace per user request):**
  ```
  Trace: "user-request"
  ├── Span: "intent-classification"
  ├── Span: "retrieval"
  ├── Span: "evidence-builder"
  └── Generation: "llm-generation"  (model, temperature, prompt, response)
  ```
- **MLflow relationship:** Langfuse and MLflow are independent side-effects.
  MLflow owns runs/metrics/params/artifacts; Langfuse owns traces/spans/prompt inspection/
  execution hierarchy/latency visualization. Neither depends on the other. Both are best-effort
  and never fail user requests.
- **No-op when unconfigured:** If env vars are missing, `LangfuseTracer` disables itself and all
  calls become no-ops.

## Noteworthy

- `.npmrc` sets `legacy-peer-deps=true`
- `.env*` in `.gitignore` — `.env.local` is never committed
- `@/*` path alias maps to repo root (e.g. `import { x } from "@/sanity/types"`)
- `sanity-plugin-markdown` provides markdown schema type
- Two document types store project content: `project` (overview fields) and `projectDocumentationPage` (rich doc pages)
- The `.agents/` directory is gitignored — local scratch space
