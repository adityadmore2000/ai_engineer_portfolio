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

## Project Schema (to match when publishing)

All text fields except `detailedContent` are `markdown` type (rendered via `<Markdown>` component). `detailedContent` is Portable Text (`block[]`).

Required fields on `project` document: `title`, `slug`.

Image fields (`coverImage`, `architectureImage`, `screenshots[]`) are Sanity image type with hotspot and `alt` string field.

Visibility flag: `published` (boolean, default `true`) — controls whether the project appears on the public site. The agent's `publish_project` and `unpublish_project` tools toggle this field.

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
```

### Architecture

```
agent/publish_agent.py   ← Python REPL with Ollama tool-calling
        ↓  (shells out)
scripts/{create-project,update-project,publish-project,unpublish-project,read-project,list-projects,delete-project}.ts   ← thin TypeScript bridges
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

Bridges auto-load `.env.local` via `scripts/load-env.ts`.

## Noteworthy

- `.npmrc` sets `legacy-peer-deps=true`
- `.env*` in `.gitignore` — `.env.local` is never committed
- `@/*` path alias maps to repo root (e.g. `import { x } from "@/sanity/types"`)
- `sanity-plugin-markdown` provides markdown schema type
- Two document types store project content: `project` (overview fields) and `projectDocumentationPage` (rich doc pages)
- The `.agents/` directory is gitignored — local scratch space
