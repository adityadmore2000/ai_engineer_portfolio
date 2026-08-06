# Sanity CRUD LLM — Subsystem Analysis

## 1. Project Overview

**Subsystem name**: Sanity CRUD LLM (Publishing Agent)

**One-paragraph summary**: A natural-language publishing agent that manages portfolio content in Sanity CMS through a Python REPL chatbot. Users say things like "Add this project: ...", "Update the results section of project X", or "Deploy my portfolio content" and the agent translates these to CRUD operations on Sanity documents. The agent also supports spec-driven project creation (parse a Markdown specification → map fields deterministically → write to Sanity), dataset synchronization (bidirectional production/local), and full project lifecycle management (create, read, update, delete, publish, unpublish).

**Primary objective**: Enable non-technical portfolio management through natural language without manual Sanity Studio interaction.

**Target users**: Portfolio owner (Aditya).

**Current maturity**: Production-ready. Four commit iterations: v1 functional TypeScript tools, v2 script → file + TS migration, v3 schema discovery + LangGraph Python agent with interactive REPL, v4 deterministic spec parser + full CRUD bridges.

---

## 2. Problem Being Solved

**Why this project exists**: The portfolio owner wanted to publish and update projects without navigating Sanity Studio or writing GROQ queries by hand. A conversational agent could interpret natural-language commands, map them to CRUD operations, and handle the complexity of Sanity mutations (image uploads, references, Portable Text).

**Engineering constraints identified**:
- Sanity API write token required (`SANITY_API_WRITE_TOKEN`). Evidence: `scripts/publish-tool.ts:5`.
- Ollama local LLM required (no cloud API). Evidence: `agent/requirements.txt` uses `langchain-ollama`.
- Deterministic spec parsing: agent is a "schema-aware mapper, never an author." Evidence: `AGENTS.md` lines 128-132.
- No `projectDocumentationPage` generation in v1. Evidence: `AGENTS.md` line 171.
- Sanity dataset names: production is `production`, local default is `local`. Evidence: `AGENTS.md` line 204.

---

## 3. High-Level Architecture

```
User (REPL)
   │
   ▼
Python LangGraph Agent (agent/publish_agent.py)
   │  • 10 tools (create, update, delete, read, list, publish,
   │              unpublish, sync-dataset, describe-schema, load-env)
   │  • Ollama-backed LLM (qwen3/llama3.2 via Ollama, port 11434)
   │  • Memory (sqlite checkpointing for session persistence)
   │  • Tool-calling state machine (langgraph.prebuilt.create_react_agent)
   │
   ▼
TypeScript Bridge Scripts (scripts/*.ts)
   │  • Thin CLI wrappers around publish-tool.ts
   │  • Auto-load .env.local via scripts/load-env.ts
   │  • 9 bridges: create, update, delete, read, list, publish,
   │               unpublish, sync-dataset, describe-schema
   │
   ▼
Core Side-Effect Layer (scripts/publish-tool.ts)
   │  • Sanity write client (with write token)
   │  • Image upload pipeline (fetch → stream → upload, with ID reuse)
   │  • Mutation builders (set, setIfMissing, unset)
   │  • Slug collision detection + error handling
   │
   ▼
Sanity CMS Content Lake
   │  • project documents
   │  • projectDocumentationPage documents (deleted alongside projects)
   │  • Assets (images)
   │
   ▼
Deterministic Spec Pipeline (parse → schema → validate)
   • parse_spec_file() → JSON {fields, provenance, source_dir, warnings, spec_sha256}
   • describe_project_schema() → live schema from sanity/schemaTypes/project.ts
   • create_project_from_spec() → deterministic map/validate → staged payload
   • confirm_pending_create() → write staged project + audit record
```

### Data Flow (typical "add a project")
1. User enters Markdown spec OR natural-language description
2. If spec path: `create_project_from_spec()` → parse → schema → deterministic map → validate → stage `PENDING_CREATE`
3. If natural language: LLM infers fields → Agent uses `CreateProjectTool` → bridge → Sanity mutation
4. Confirmation prompt before any Sanity write
5. On confirm: write to Sanity via `publish-tool.ts`, save audit record to `.agents/spec-<slug>-<timestamp>.json`
6. On reject: discard staged payload

### Data Flow (spec-driven project creation)
```
Spec MD file
   │
parse_spec_file() → {fields, provenance, source_dir, warnings, spec_sha256}
   │
describe_project_schema() → live schema (mtime-cached)
   │
create_project_from_spec()
   │  • Deterministic map spec fields → Sanity schema fields
   │  • Coerce types (markdown → string, boolean → boolean, images → upload tuples)
   │  • Validate all required fields present, types match
   │  • If validation fails: 1 LLM self-repair retry (constrained output)
   │  • If still fails: surface to user, no Sanity write
   │  • Stage PENDING_CREATE with full payload + provenance
   │
confirm_pending_create() → write to Sanity + .agents/audit file
```

### Data Flow (dataset sync)
```
User: "Pull the latest production changes"
   │
sync_production_to_local()
   │  • sanity dataset export production (production dataset)
   │  • sanity dataset import file.tar.gz local --replace
   │  • Cleans up export file
   │
User: "Deploy my portfolio content"
   │
sync_local_to_production()
   │  • sanity dataset export local (local dataset)
   │  • sanity dataset import file.tar.gz production --replace
   │  • Cleans up export file
```

---

## 4. Major Engineering Components

### 4.1 Python LangGraph Agent (`agent/publish_agent.py`)
- **Responsibility**: Conversational REPL that interprets natural-language publishing commands and invokes bridge scripts.
- **Important file**: `agent/publish_agent.py:1-580`
- **Interactions**: Uses `create_react_agent` (LangGraph prebuilt) with Ollama `ChatOllama(model="qwen3:1.7b")`. 10 tool functions. SQLite `MemorySaver` for session persistence (`.agent_memory/`). REPL loop (lines 540-575).
- **Design reasoning**: LangGraph agent chosen over TypeScript `useChat` for REPL interactivity and tool-calling state machine. Python ecosystem (langchain-ollama, langgraph) better suited for local Ollama.

### 4.2 Tool Layer — 10 Bridge Functions (`agent/publish_agent.py:35-350`)
| Tool | Shell command | Purpose |
|------|--------------|---------|
| `CreateProjectTool` | `npx ts-node scripts/create-project.ts <json>` | Create project (fails if slug exists) |
| `UpdateProjectTool` | `npx ts-node scripts/update-project.ts <json> <slug>` | Partial patch update |
| `DeleteProjectTool` | `npx ts-node scripts/delete-project.ts <slug>` | Delete project + doc pages |
| `ReadProjectTool` | `npx ts-node scripts/read-project.ts <slug>` | Return project JSON |
| `ListProjectsTool` | `npx ts-node scripts/list-projects.ts [search]` | List/all with optional title filter |
| `PublishProjectTool` | `npx ts-node scripts/publish-project.ts <slug>` | Set `published = true` |
| `UnpublishProjectTool` | `npx ts-node scripts/unpublish-project.ts <slug>` | Set `published = false` |
| `SyncDatasetTool` | `npx ts-node scripts/sync-dataset.ts <dir>` | Export/import dataset |
| `DescribeSchemaTool` | `npx ts-node scripts/describe-schema.ts project` | Print live project schema |
| `loadEnv` | Internal | Read `.env.local`, set env vars for subprocess |

### 4.3 Core Side-Effect Layer (`scripts/publish-tool.ts`)
- **Responsibility**: All Sanity I/O. Image upload, mutation construction, error handling.
- **Important file**: `scripts/publish-tool.ts:1-300`
- **Sanity operations**:
  - `createProject()`: Creates `project` document, handles image upload, builds mutations with `setIfMissing` for arrays/slugs
  - `updateProject()`: Partial patch via `client.patch(id).set(fields).commit()`
  - `deleteProject()`: Queries all `projectDocumentationPage` references first, deletes them, then deletes project
  - `publishProject()`/`unpublishProject()`: Toggle `published` boolean
  - `syncDataset()`: Exports source → imports destination with `--replace`
- **Image upload pipeline** (lines 50-80): `fetchImage()` → stream → `client.assets.upload('image', stream)` → returns asset ID. Reuses same ID if duplicate detected.

### 4.4 Schema Discovery (`scripts/describe-schema.ts`)
- **Responsibility**: Discover live Sanity `project` schema by executing validation functions against a mock `Rule` API.
- **Important file**: `scripts/describe-schema.ts:1-150`
- **Design reasoning**: No LLM, no hardcoded field lists. Imports `projectSchema` from `sanity/schemaTypes/project.ts`, instantiates each field's validation with a mock `Rule` singleton that records type constraints. Returns normalized JSON of all fields, types, and validation rules. Cache is mtime-keyed (auto-refreshes on schema file change).
- **Tradeoffs**: Must mock entire Sanity validation API. Only captures field types/constraints; does not capture custom validators (e.g., slug uniqueness).

### 4.5 Deterministic Spec Pipeline (in agent orchestrator)
- **Responsibility**: Parse Markdown spec → deterministic map → validate → stage → confirm.
- **Artifacts**:
  - `parse_spec_file(path)`: Deterministic Markdown bullet parser. Rejects non-`.md`, oversized specs (>30K chars), relative image paths. Returns `{fields, provenance, source_dir, warnings, spec_sha256}`.
  - `create_project_from_spec(spec_path)`: Orchestrator. Parse → schema → map → validate. LLM self-repair retry (exactly 1) if validation fails. Stages `PENDING_CREATE`.
  - `confirm_pending_create()`: Writes staged project + `.agents/spec-<slug>-<timestamp>.json` audit record.
  - `cancel_pending_create()`: Discards staged payload.
- **Design reasoning**: "Happy path is fully deterministic" (`AGENTS.md` line 154). LLM only as self-repair fallback when validation fails. `published` defaults to `true`.

### 4.6 Load Env Utility (`scripts/load-env.ts`)
- **Responsibility**: Parse `.env.local` and set environment variables before bridge execution.
- **Important file**: `scripts/load-env.ts:1-25`
- **Design reasoning**: Bridges need `SANITY_API_WRITE_TOKEN`. Loaded once per invocation rather than imported across modules. `dotenv` dependency.

### 4.7 Bridge Scripts (`scripts/create-project.ts`, `scripts/update-project.ts`, etc.)
- **Responsibility**: CLI wrappers that parse argv, call `publish-tool.ts` functions, handle errors, print JSON output.
- **Design reasoning**: Thin layer. Each is independently executable via `npx ts-node`. Enables Python subprocess calling. The agent never imports TypeScript directly — always shells out.

---

## 5. Technologies Used

| Technology | Role | Where it appears | Why chosen |
|------------|------|-----------------|------------|
| Python 3 | Agent runtime | `agent/publish_agent.py` | REPL, LangGraph, Ollama SDK |
| LangGraph (Python) | Agent state machine | `agent/publish_agent.py:540-575` | `create_react_agent`, tool-calling, memory |
| Ollama | Local LLM | `agent/publish_agent.py` (ChatOllama) | Local inference, no GPU needed |
| TypeScript | Bridge scripts + core Sanity layer | `scripts/*.ts` | Native Sanity client, same codebase |
| Sanity Client (npm) | CMS mutations | `scripts/publish-tool.ts:44` | Official SDK |
| Sanity CLI | Dataset export/import | `scripts/sync-dataset.ts:20-35` | Direct dataset operations |
| dotenv | Environment loading | `scripts/load-env.ts:5` | Standard |
| SQLite (aiosqlite) | Agent checkpointing | `agent/publish_agent.py:560` | Session persistence |
| Pydantic (? via LangChain) | Structured output | Agent tool function decorators | Input validation |

---

## 6. Architecture Decisions

### Decision 1: Two-Layer Architecture (Python Agent + TypeScript Bridge)
- **Evidence**: `AGENTS.md` lines 179-200
- **Rationale**: Python has better Ollama/LangGraph SDK support. TypeScript has native Sanity client. Bridge pattern separates concerns: agent handles conversation + tool routing; TypeScript handles Sanity I/O + error handling. Each layer independently testable.
- **Tradeoffs**: Subprocess calls add latency (~200-500ms per invocation). Error propagation across language boundary requires JSON serialization. Debugging requires following the shell call chain.

### Decision 2: Deterministic Spec Parsing (No LLM in Happy Path)
- **Evidence**: `AGENTS.md` lines 128-156, "Determinism stance" section
- **Rationale**: Turns a Markdown spec into a populated `project` document deterministically. Agent is "schema-aware mapper, never an author" — copies verbatim, coerces types, flags uncertainty, asks confirmation.
- **Tradeoffs**: Spec must follow strict labeled-bullet format. Cannot use freeform natural language for spec-driven creation. Images must have absolute paths.

### Decision 3: Schema Discovery via Mock Rule API (Not Static Config)
- **Evidence**: `AGENTS.md` lines 175-180
- **Rationale**: Edit `sanity/schemaTypes/project.ts` (add field, mark required), and agent picks it up next call. No prompt, parser, or validation code changes required. `setGenericFields` copies new scalar/markdown/array-of-string fields generically.
- **Tradeoffs**: Must mock entire Sanity Rule API. Custom validators (slug uniqueness) not captured. Mtime-keyed cache means first call after schema edit is slightly slower.

### Decision 4: SQLite MemorySaver for Session Persistence
- **Evidence**: `agent/publish_agent.py:560`
- **Rationale**: LangGraph `MemorySaver` backed by SQLite. Persists conversation state across agent restarts. `.agent_memory/` directory is gitignored.
- **Tradeoffs**: SQLite file could grow unbounded. No TTL or archival strategy.

### Decision 5: `published` defaults to `true`
- **Evidence**: `AGENTS.md` line 159
- **Rationale**: Matches existing `create_project` behavior. Users explicitly unpublish if needed.
- **Tradeoffs**: Spec-driven creates are immediately visible.

### Decision 6: Dataset Sync via `sanity dataset` CLI (Not Manual Mutation)
- **Evidence**: `scripts/sync-dataset.ts:20-35`
- **Rationale**: Uses `sanity dataset export` + `sanity dataset import --replace`. Direct, atomic, built-in Sanity CLI feature. Not custom mutation logic.
- **Tradeoffs**: Destructive (`--replace`). Entire dataset replaced, not merged. Requires Sanity CLI installed and authenticated.

### Decision 7: Image Upload with ID Reuse
- **Evidence**: `scripts/publish-tool.ts:50-80`
- **Rationale**: Fetches image URL → streams → uploads to Sanity assets. Reuses asset ID if duplicate detected (by URL hash).
- **Tradeoffs**: Requires network fetch. Image URL must be accessible from host. No local file support.

---

## 7. Engineering Challenges

### Challenge 1: No `projectDocumentationPage` Generation in v1
- **Problem**: The `projectDocumentationPage` document type stores rich Portable Text content. The agent only creates/updates the `project` overview document. Cannot create or update detailed documentation pages.
- **Approach**: Explicitly deferred. `AGENTS.md` line 171: "No `projectDocumentationPage` generation in v1."
- **Outcome**: Documentation pages must be created via Sanity Studio or a future v2 agent.

### Challenge 2: Spec Format Strictness
- **Problem**: Spec must follow exact labeled-bullet format (`- **fieldName**: value`). Freeform natural-language descriptions cannot drive `create_project_from_spec()`.
- **Approach**: Natural-language project creation goes through standard LangGraph agent tool-calling path (LLM infers fields → tool bridge → Sanity). Spec-driven is separate deterministic pipeline.
- **Outcome**: Two parallel paths for project creation: deterministic (spec) and conversational (LLM).

### Challenge 3: Subprocess Latency
- **Problem**: Each tool call shells out to `npx ts-node scripts/<bridge>.ts <args>`. Cold starts add 200-500ms latency per invocation.
- **Approach**: No mitigation. Acceptable overhead for interactive REPL use.
- **Outcome**: Agent feels slightly sluggish for multi-step workflows.

### Challenge 4: Cross-Language Error Propagation
- **Problem**: Errors in TypeScript bridge (e.g., "slug already exists") must be serialized to stdout, read by Python subprocess, and surfaced to user. Non-zero exit codes carry no structured error data.
- **Approach**: JSON output on stdout. Error message in JSON body. Agent parses stdout, includes raw output in tool result.
- **Outcome**: Error messages reach user, but stack traces lost across boundary.

### Challenge 5: Dataset Sync Destructive
- **Problem**: `sync_production_to_local()` and `sync_local_to_production()` replace entire dataset with `--replace`. No merge, no diff, no confirmation of content counts.
- **Approach**: Export/import with `--replace`. Agent warns user about destructive nature.
- **Outcome**: Simple but dangerous. One wrong command overwrites live production data.

### Challenge 6: Image Path Requirements
- **Problem**: Spec-driven creation rejects relative image paths. All images MUST be absolute URLs.
- **Approach**: Reject relative paths during `parse_spec_file()`. Return warning to user.
- **Outcome**: Users must provide absolute URLs or skip images.

### Challenge 7: LLM Self-Repair Retry Strategy
- **Problem**: When deterministic validation fails, exactly 1 LLM self-repair retry is attempted. If that also fails, surfaced to user.
- **Approach**: One structured-output LLM call constrained to the discovered-schema Pydantic model, then re-runs the SAME validator. No iterative refinement.
- **Outcome**: Limited recovery. Complex schema mismatches may not be fixable in one retry.

---

## 8. Debugging & Iteration Evidence

### Four Commit Evolution (from `PUBLISHING_AGENT_ENGINEERING_REPORT.md`)
1. **v1 — Functional TypeScript Tools** (commit `365265fd`): Raw Sanity mutations in `scripts/publish-tool/`. Direct usage via command line. No Python agent.
2. **v2 — Script → File + TS Migration** (commit `a4a9f4f7`): Moved to `scripts/` directory. Switched to TypeScript. Added `load-env.ts`.
3. **v3 — Schema Discovery + LangGraph Agent** (commit `fdf2b0fa`): Added `describe-schema.ts`. Wrote Python LangGraph agent with 10 tools. Interactive REPL.
4. **v4 — Deterministic Spec Parser + Full CRUD** (commit `14ce88d9`): Added spec-driven creation pipeline. Full CRUD bridges. `.agents/` audit trail. AGENTS.md documentation.

### Agent Evolution Stats
| Metric | v1 | v2 | v3 | v4 |
|--------|----|----|----|----|
| Languages | Node + TS | TS | TS + Python | TS + Python |
| Architecture | Direct Sanity CLI | Script bridges | LangGraph agent + bridges | + Spec pipeline |
| Tool count | 2-3 | 3-4 | 10 | 10 |
| Determinism | No | No | Schema discovery | Spec parsing |
| Audit trail | No | No | No | `.agents/*.json` |

### Existing Documentation
- `PUBLISHING_AGENT_ENGINEERING_REPORT.md`: Full engineering journey, 52K+ characters, 4 commits
- `AGENTS.md`: Developer documentation covering both subsystems
- `sanity/schemaTypes/project.ts`: Live schema definition (single source of truth)

---

## 9. Measurable Outcomes

### Agent Capabilities
| Operation | Support | Method |
|-----------|---------|--------|
| Create project | ✓ | Tool bridge + spec pipeline |
| Update project | ✓ | Partial patch (true partial) |
| Delete project | ✓ | Project + doc pages cascade |
| Read project | ✓ | JSON output |
| List projects | ✓ | Optional title filter |
| Publish project | ✓ | Toggle `published = true` |
| Unpublish project | ✓ | Toggle `published = false` |
| Dataset sync | ✓ | Bidirectional prod/local |
| Schema discovery | ✓ | Live schema via mock Rule API |
| Spec-driven create | ✓ | Deterministic parse → map → validate → confirm |

### Code Quality
| Metric | Result | Source |
|--------|--------|--------|
| TypeScript typecheck | PASSED | `Runtime_Fix_Report.md:161` |
| ESLint | PASSED | Same, line 165 |
| Python syntax | Valid | `agent/publish_agent.py` |
| Requirements | 3 packages | `agent/requirements.txt` |

---

## 10. Ownership Signals

- **Custom Python LangGraph agent**: 580+ lines, 10 tools, REPL loop, SQLite memory.
- **Custom TypeScript bridge architecture**: 9 bridge scripts, 1 core side-effect layer, 1 schema discoverer.
- **Custom deterministic spec pipeline**: Parse → schema → map → validate → LLM self-repair → confirm.
- **Custom Sanity image upload pipeline**: Fetch → stream → upload with ID reuse.
- **Custom schema discovery**: Mock Sanity Rule API execution for live schema introspection.
- **4-commit engineering evolution**: Raw CLI → scripts → LangGraph agent → spec pipeline.
- **Full audit trail**: `.agents/spec-<slug>-<timestamp>.json` for every spec-driven create.
- **Comprehensive engineering report**: `PUBLISHING_AGENT_ENGINEERING_REPORT.md` with full decision log.
