# Publishing AI Agent — Engineering Report

---

# 1. Executive Summary

The Publishing AI Agent is a **dual-system natural-language portfolio management platform** that allows Aditya More to manage his Sanity CMS portfolio through natural language commands. It consists of two independent subsystems:

**System 1 — Python Publishing Agent** (`agent/publish_agent.py`): A LangGraph-based tool-calling agent that manages the full CRUD lifecycle of portfolio projects on Sanity CMS. It runs as an interactive REPL and interprets natural-language commands like "Add a new project", "Update the results section of warehouse-parcel-monitoring-system", or "Deploy my portfolio content". The agent shells out to TypeScript bridge scripts that perform Sanity mutations, image uploads, and dataset synchronization.

**System 2 — TypeScript Portfolio Chat Assistant** (`lib/agent/`, `lib/ai/`, `lib/retrieval/`): A retrieval-augmented generation (RAG) pipeline that powers a conversational chat interface at `/api/chat`. Users query the portfolio with questions like "Which projects use Python?" or "Tell me about the video captioning agent" and receive grounded, evidence-backed responses streamed via Server-Sent Events.

**Key technologies**: LangGraph, LangChain, Qdrant, vLLM, Ollama, HuggingFace Transformers (embeddings), Next.js App Router, Sanity CMS, MLflow, Langfuse.

---

# 2. Problem Statement

## Why this project exists

Aditya More maintains a portfolio website backed by Sanity CMS. Without the agent, every change requires:
1. Opening the Sanity Studio UI
2. Manually filling forms for each project
3. Uploading images through the Sanity asset pipeline
4. Toggling visibility for each project
5. Managing local vs. production datasets through CLI exports/imports

## What manual workflow it replaces

A multi-step, error-prone process where content updates require navigating a headless CMS UI, manually typing structured content, and running CLI commands to synchronize environments.

## Why existing workflow was inefficient

- **No batch operations**: Adding a project with 10 fields, images, and metadata required filling 10+ form fields manually.
- **No content verification**: Inconsistent content between local and production datasets.
- **No automation**: Publishing/unpublishing required manual boolean toggles in the CMS UI.
- **No portfolio Q&A**: Visitors could not ask natural-language questions about the portfolio.

## Engineering constraints

- Sanity Content Lake is the single source of truth; no custom backend.
- Local LLM only (Ollama / vLLM); no cloud API calls for LLM inference.
- All infrastructure runs via Docker Compose (Qdrant, vLLM, MLflow).
- Agents and observability must degrade gracefully when unconfigured.
- Deterministic spec-parsing for project creation (no LLM content generation).

## What success looked like

A single natural-language command replaces a multi-step manual workflow. A chat interface answers portfolio questions grounded in actual Sanity content. Both systems work with local LLMs and are observable through MLflow and Langfuse.

---

# 3. Engineering Journey

The Publishing AI Agent was built incrementally across four commits. Each commit represents a distinct architectural addition.

---

## Commit 1: `6d3f719` — "Added agentic capability"

### Goal
Create the first iteration of the publishing agent — a Python REPL that uses LangGraph and Ollama to manage Sanity projects through natural language.

### Motivation
A manual publish script (`scripts/publish.ts`) already existed. The goal was to wrap it in an AI agent that understands intent and maps it to the correct operation.

### Major code additions

| File | Purpose |
|------|---------|
| `agent/publish_agent.py` (305 lines) | Agent REPL with LangGraph graph, system prompt, 10 tools |
| `agent/requirements.txt` | `langgraph>=0.4.0`, `langchain-ollama>=0.3.0` |
| `scripts/publish-tool.ts` (314 lines) | Shared TypeScript layer for Sanity CRUD, image uploads |
| `scripts/load-env.ts` | dotenv loader for bridge scripts |
| `scripts/list-projects.ts` | List projects by title search |
| `scripts/read-project.ts` | Fetch single project by slug |
| `scripts/delete-project.ts` | Delete project + documentation pages |
| `AGENTS.md` | Developer documentation |

### Architectural evolution

The architecture introduced a **two-layer design**:

```
User (REPL input)
    ↓
LangGraph Agent (Python, Ollama, tool-calling)
    ↓  (shells out subprocess)
TypeScript Bridge Scripts
    ↓  (Sanity client mutations)
Sanity Content Lake
```

Key design decisions:
- **Python for the agent**: LangGraph + LangChain ecosystem is Python-native.
- **TypeScript for Sanity I/O**: The existing Next.js codebase already had Sanity clients, types, and GROQ queries.
- **Bridge pattern**: The Python agent never touches Sanity directly — it shells out to TypeScript scripts via subprocess.

### LangGraph graph (initial)

A minimal 2-node graph:
```
START → chatbot (LLM with tools) → tools_condition → tools (ToolNode) → chatbot → END
```

The `chatbot` node invokes the LLM with the conversation history. The `tools_condition` built-in routes to `tools` if the LLM returns a tool call, or `END` if it's a text response. Tool responses are fed back to `chatbot`.

### Tools (initial set)

1. `read_file(path)` — read a file from disk (for consuming markdown content)
2. `find_markdown(directory)` — discover `.md` files recursively
3. `list_dir(path)` — list directory contents
4. `list_projects(search?)` — Sanity project listing with optional title filter
5. `read_project(slug)` — fetch full project data from Sanity
6. `create_project(data)` — create a new project (fails if slug exists)
7. `update_project(slug, data)` — partial patch an existing project
8. `publish_project(slug)` — set `published=true`
9. `unpublish_project(slug)` — set `published=false`
10. `delete_project(slug)` — delete project + documentation pages

### Remaining limitations
- No dataset synchronization (prod ↔ local).
- Field list hardcoded in both the Python agent and TypeScript bridge.
- `create_project` was the only lifecycle mutation; no dedicated `publish/unpublish` bridges.
- The `publish.ts` script did upsert (create-or-update), conflating two distinct operations.
- No spec-driven project creation — content had to be extracted by the LLM from user messages.

### Lessons learned
- The tool-calling pattern mapped well to the CRUD lifecycle — each operation maps to a single tool with clear semantics.
- Separating the agent layer (Python) from the I/O layer (TypeScript) enabled independent testing and evolution.
- The LLM needed an extremely detailed system prompt to distinguish CREATE vs UPDATE vs PUBLISH vs UNPUBLISH intents.

---

## Commit 2: `c2a9107` — "Add configurable experiment harness with MLflow integration"

### Goal
Extract the lifecycle operations into discrete, independently-callable TypeScript bridges. Add MLflow experiment tracking for batch reproducibility. Introduce the `published` visibility flag to the project schema.

### Motivation
The initial `publish.ts` script was monolithic — it did upsert (create-or-update) in a single function. This conflated CREATE and UPDATE semantics and made the LLM's task harder. The tool definitions needed to match the actual operations 1:1.

### Major code additions

| File | Change |
|------|--------|
| `scripts/create-project.ts` | New standalone bridge (fails if slug exists) |
| `scripts/update-project.ts` | New standalone bridge (fails if slug missing; true partial patch) |
| `scripts/publish-project.ts` | New standalone bridge (toggle `published=true`) |
| `scripts/unpublish-project.ts` | New standalone bridge (toggle `published=false`) |
| `scripts/publish-tool.ts` | Refactored: extracted `createProject`, `updateProject`, `publishProjectBySlug`, `unpublishProjectBySlug`, `deleteProject` into pure functions. Added `setGenericFields()` for schema-agnostic field passthrough. |
| `sanity/schemaTypes/project.ts` | Added `published` boolean field with `initialValue: true` |
| `agent/publish_agent.py` | Restructured: separated `create_project`, `update_project`, `publish_project`, `unpublish_project` into distinct tools |

### Architectural evolution

**Before**: One tool → one script (upsert)
**After**: Five tools → five scripts, each with a single, well-defined behavior:

```
create_project(data)       → create-project.ts  [fails if slug exists]
update_project(slug, data) → update-project.ts   [fails if slug not found]
publish_project(slug)      → publish-project.ts  [sets published=true]
unpublish_project(slug)    → unpublish-project.ts [sets published=false]
delete_project(slug)       → delete-project.ts   [deletes project + doc pages]
```

This 1:1 mapping eliminated ambiguity in the LLM's tool selection. The system prompt now explicitly maps user intent phrases to specific tools:

```
User says "Publish X" → publish_project(slug)
User says "Unpublish X" → unpublish_project(slug)
User says "Create/add new" → create_project(data)
User says "Update/change/modify" → update_project(slug, data)
```

The `setGenericFields()` function (`scripts/publish-tool.ts:59-68`) was introduced to future-proof the bridge layer: any field that is not an image, alt-text, or meta field (title, slug, published) is automatically copied from the agent's payload into the Sanity document. This means adding a new field to the Sanity schema requires zero changes in the TypeScript bridge — it "just works."

### Remaining limitations
- No dataset-level synchronization (production ↔ local).
- The agent still used a hardcoded field list in the Python code.
- No schema discovery — adding a required field to the project schema meant manually updating the Python code.
- No spec-driven project creation.

### Lessons learned
- 1:1 tool-to-operation mapping is critical for LLM tool-selection accuracy.
- The `setGenericFields` pattern enabled schema evolution without bridge code changes.
- Visibility should be a toggle (`publish_project` / `unpublish_project`), not a property on create/update — separating concerns improved the LLM's intent classification.

---

## Commit 3: `b7fb691` — "Add dataset synchronization tools"

### Goal
Enable full-dataset synchronization between production and local Sanity environments through natural language.

### Motivation
The developer workflow required periodic syncing between the local development dataset and the production dataset. This was done manually through `sanity dataset export` / `sanity dataset import` CLI commands. Automating this into a tool-callable operation eliminated a multi-step, error-prone manual process.

### Major code additions

| File | Change |
|------|--------|
| `scripts/sync-dataset.ts` (108 lines) | New script: exports source dataset, imports into destination with `--replace` |
| `agent/publish_agent.py` | Added `sync_production_to_local()` and `sync_local_to_production()` tools |

### Architectural evolution

The synchronization flow:

```
sync_production_to_local()
    ↓  (npx tsx sync-dataset.ts prod-to-local)
    ↓  sanity dataset export production → temp.tar.gz
    ↓  sanity dataset import temp.tar.gz local --replace
    ✅  Local dataset = production snapshot

sync_local_to_production()
    ↓  (npx tsx sync-dataset.ts local-to-prod)
    ↓  sanity dataset export local → temp.tar.gz
    ↓  sanity dataset import temp.tar.gz production --replace
    ✅  Production dataset = local snapshot (destructive)
```

The script auto-propagates `SANITY_API_WRITE_TOKEN` to `SANITY_AUTH_TOKEN` so the Sanity CLI can authenticate non-interactively (`scripts/sync-dataset.ts:51-56`). The temporary tarball is cleaned up in a `finally` block regardless of success/failure.

**Critical design decision**: Synchronization is a **dataset-level** operation, distinct from `publish_project(slug)` (which toggles visibility of a single project). The system prompt explicitly maps NLP intents:

```
"Pull prod changes"   → sync_production_to_local()
"Deploy my portfolio" → sync_local_to_production()
```

### Remaining limitations
- No schema discovery — the agent still carried a hardcoded field list.
- No spec-driven project creation.
- No granular sync (filter by project, merge specific documents).
- Destructive only — no diff or merge strategy.

### Lessons learned
- Dataset-level operations needed to be clearly distinguished from document-level operations in the system prompt to prevent the LLM from confusing "deploy" with "publish."
- The tarball cleanup pattern (finally block) is essential — leaving stale tarballs in `/tmp` would accumulate over repeated syncs.

---

## Commit 4: `d042377` — "Implement spec-driven project creation with dynamic schema discovery"

### Goal
Enable project creation from structured Markdown specification files. Implement live schema discovery from Sanity Studio code so the agent automatically adapts to field changes without code modifications.

### Motivation
The previous `create_project` tool required the LLM to extract all project fields from unstructured natural-language conversation. This was error-prone: the LLM could hallucinate fields, omit required fields, or misformat content. The solution was:

1. A **rigid Markdown spec format** (`- **field**: value`) that maps 1:1 to Sanity fields.
2. **Deterministic parsing** — no LLM in the creation pipeline (except as a self-repair fallback).
3. **Live schema discovery** — executing validation functions against mock Rule objects to learn the schema at runtime.

### Major code additions

| File | Change |
|------|--------|
| `agent/publish_agent.py` | +692 lines: `parse_spec_text`, `parse_spec_file`, `describe_project_schema`, `normalize_and_validate`, `_llm_repair`, `_build_payload_pydantic_model`, `create_project_from_spec`, `confirm_pending_create`, `cancel_pending_create` |
| `scripts/describe-schema.ts` (227 lines) | New: imports Sanity schema, runs validation fns against `MockRule` proxy, outputs normalized JSON |
| `scripts/publish-tool.ts` | Added `__markdownDir__` support for image path resolution |

### Architectural evolution — Spec-driven pipeline

```
Spec file (.md with - **field**: value grammar)
    ↓  parse_spec_file(path)
Deterministic Bullet Parser (regex-based, no LLM)
    ↓  fields + provenance + warnings (JSON)
    ↓  describe_project_schema()
Schema Discovery (executes validation fns against MockRule)
    ↓  discovered schema (cached, mtime-keyed)
    ↓  normalize_and_validate(parsed, schema)
Deterministic Type Coercion + Constraint Validation
    ↓
    ├── [valid] → Stage PENDING_CREATE → User confirms → confirm_pending_create() → Sanity + audit log
    │
    └── [errors] → _llm_repair() — 1 LLM retry with structured output
            ├── [valid after repair] → Stage PENDING_CREATE
            └── [still invalid] → Surface to user, nothing written
```

### Key innovations in this commit

**1. Schema Discovery (`scripts/describe-schema.ts:41-75`)**

Instead of hardcoding field names and types, the system imports the Sanity schema definition from `sanity/schemaTypes/project.ts` and executes each field's `validation` function against a JavaScript `Proxy` that records method calls:

```typescript
// The mock Rule records method calls like .required(), .integer(), .min(0)
const { rule, constraints } = createMockRule();
validationFn(rule);  // calls Rule.required().integer().min(0) → records ["required","integer","min"]
```

This extracts the full schema — field names, types, constraints (required, integer, uri schemes, min/max) — as a JSON document. The Python agent caches this output and refreshes it only when `sanity/schemaTypes/project.ts` changes (mtime-keyed).

**2. Deterministic Markdown Parser (`agent/publish_agent.py:321-424`)**

The `_BULLET_RE` regex (`^- \*\*([^*]+)\*\*:\s?(.*)$`) parses spec files in this format:

```markdown
- **title**: My Project
- **slug**: `my-project`
- **technologies**:
  - Python
  - Docker
- **problemStatement**:
  Multiline prose that explains
  the problem in detail.
```

The parser returns `{fields, provenance}` where `provenance` maps each field to its source line number — enabling the agent to say "field `problemStatement` (line 15) maps to Sanity field `problemStatement`."

**3. Type Coercion + Validation (`agent/publish_agent.py:637-700`)**

After parsing, each field is coerced to the target Sanity type and validated against discovered constraints. For example, a spec value `"0"` for a `number` field with `integer: true` and `min: 0` passes all checks. A value `"-5"` fails the `min: 0` constraint. A `url` field validates the URI scheme against the allowed schemes.

**4. LLM Self-Repair Fallback (`agent/publish_agent.py:731-774`)**

Only when deterministic validation fails, a single LLM retry is attempted. The LLM is given:
- The discovered schema (as a constrained Pydantic model via `with_structured_output`)
- The raw parsed spec values
- The specific validation errors

The LLM may only emit fields that exist on the discovered schema — hallucinated fields are rejected by Pydantic. This is a **1-retry** policy; if the LLM output still fails validation, the request is surfaced to the user with errors, and nothing is written to Sanity.

**5. Human Confirmation Gate (`agent/publish_agent.py:839-903`)**

`create_project_from_spec` does NOT write to Sanity. It stages the proposed payload in `_PENDING_CREATE` and returns:
- The proposed payload (all fields, values, and types)
- `uncertain_fields` (fields the mapping was uncertain about)
- `provenance` (which spec line each field came from)

The user reviews this and says "yes" to call `confirm_pending_create()`, which writes to Sanity and creates an audit record at `.agents/spec-<slug>-<timestamp>.json`.

### Remaining limitations after this commit
- No `projectDocumentationPage` generation in v1 — only the `project` overview document.
- Single document type discovery (only `project`).
- Self-repair is limited to one retry (no iterative loop).
- No incremental spec updates — the full spec must be reprocessed.

### Lessons learned
- Deterministic parsing eliminates an entire class of LLM hallucination errors.
- Live schema discovery means the agent automatically adapts when a developer adds/renames/requires a field — no code changes needed.
- The Pydantic constrained-output approach for self-repair is effective: `with_structured_output` prevents the LLM from emitting fields that don't exist in the schema.
- The human confirmation gate is essential for a write operation; the LLM's proposed mapping should be reviewable before touching Sanity.

---

# 4. High-Level Architecture

The repository contains **two independent agent systems** that share infrastructure:

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                            │
├──────────────────────┬───────────────────────────────────────┤
│  Terminal/CLI (REPL) │  Web Chat UI (Next.js)                │
│  agent/publish_agent │  app/api/chat/route.ts → SSE stream   │
│       .py            │                                       │
└─────────┬────────────┴──────────────┬────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│  LangGraph Graph  │    │  Retrieval-First LLM Pipeline        │
│  (Python)         │    │  (TypeScript)                        │
│  ┌──────────────┐ │    │  ┌────────────────────────────┐      │
│  │ chatbot node │ │    │  │  1. intent-router.ts       │      │
│  │   (LLM+tools)│ │    │  │     (greeting/out-of-scope/ │      │
│  │      ↕       │ │    │  │      portfolio/ambiguous)   │      │
│  │  tools node  │ │    │  │  2. retrieval/index.ts     │      │
│  └──────────────┘ │    │  │     (structured patterns    │      │
│                   │    │  │      → Sanity GROQ           │      │
│  Ollama           │    │  │      │  fallback: semantic)  │      │
│  (qwen3:4b)       │    │  │  3. evidence-builder.ts     │      │
└────────┬──────────┘    │  │     (dedup, format, trunc)  │      │
         │               │  │  4. llm-pipeline.ts         │      │
         │ subprocess    │  │     (streaming LLM +         │      │
         │               │  │      evidence injection)     │      │
         ▼               │  └────────────────────────────┘      │
┌──────────────────┐    │                                      │
│ TypeScript Bridge │    │  vLLM (Qwen/Qwen3-4B-Instruct)      │
│ Scripts           │    │  Qdrant (semantic search)            │
│ ┌──────────────┐ │    │  HuggingFace Transformers           │
│ │create-project│ │    │  (Xenova/nomic-embed-text-v1.5)     │
│ │update-project│ │    │                                      │
│ │publish-proj  │ │    │  Observability:                      │
│ │unpublish-proj│ │    │  ├── Langfuse (traces/spans/gens)    │
│ │delete-project│ │    │  ├── MLflow (runs/metrics/params)    │
│ │list-projects │ │    │                                      │
│ │read-project  │ │    └──────────────────────────────────────┘
│ │sync-dataset  │ │
│ │describe-schem│ │
│ │index-content │ │
│ └──────┬───────┘ │
└────────┼─────────┘
         │
         ▼
┌──────────────────┐
│   Sanity CMS     │
│  (Content Lake)  │
│                  │
│  Documents:      │
│  - project       │
│  - docPage       │
│  - siteSettings  │
│  - experience    │
│  - skillCategory │
└──────────────────┘
```

---

# 5. Request Lifecycle

## Publishing Agent — "Publish my latest project"

```
1. User types: > Publish my latest project

2. Python REPL wraps input in SystemMessage + ("human", "Publish my latest project")
   and passes to agent.stream().

3. LangGraph executes the graph:
   a. chatbot node: ChatOllama.invoke(messages)
      → LLM reads system prompt, identifies intent as "PUBLISH"
      → LLM needs to find which project → calls list_projects() tool

   b. tools_condition routes to "tools" node

   c. ToolNode executes list_projects() → shells out:
      npx tsx scripts/list-projects.ts
      → Sanity GROQ: *[_type == "project"] | order(title asc)
      → Returns JSON list of all projects

   d. Tool response fed back to chatbot node
      → LLM sees list of projects, matches "latest" to the most recent
      → LLM calls publish_project(slug)

   e. tools_condition routes to "tools" node

   f. ToolNode executes publish_project(slug) → shells out:
      npx tsx scripts/publish-project.ts <slug>
      → scripts/publish-tool.ts: publishProjectBySlug()
      → Sanity mutation: client.patch(id).set({published: true}).commit()
      → Returns "✅ Published project '...'"

   g. Tool response → chatbot → LLM reports success: "I've published Project X."

4. Agent prints response to REPL.
```

## Publishing Agent — "Sync production to local"

```
1. User types: > Sync production to local

2. chatbot node → LLM matches intent to sync_production_to_local()
   → LLM calls sync_production_to_local() tool

3. tools node executes → shells out:
   npx tsx scripts/sync-dataset.ts prod-to-local

4. sync-dataset.ts:
   a. Sets SANITY_AUTH_TOKEN = SANITY_API_WRITE_TOKEN
   b. npx sanity dataset export production → /tmp/production-sync-<ts>.tar.gz
   c. npx sanity dataset import /tmp/production-sync-<ts>.tar.gz local --replace
   d. Removes temp tarball

5. Tool response → chatbot → "Synced production → local."
```

## Chat Assistant — "Which projects use Python?"

```
1. POST /api/chat → app/api/chat/route.ts
   → body: { messages: [{role: "user", content: "Which projects use Python?"}] }

2. orchestrator.ts:
   a. classifyIntent("Which projects use Python?")
      → intent-router.ts: regex check against GREETING_PATTERNS → no match
      → LLM (getIntentModel): "Classify this: ..." → "portfolio"
      → returns "portfolio"

   b. searchPortfolio("Which projects use Python?")
      → retrieval/index.ts: iterates STRUCTURED_PATTERNS
      → Pattern 1 matches: /which projects use\s+(.+)/i
      → Calls searchByTechnology("python")
      → Sanity GROQ: *[_type=="project" && published==true && "python" in technologies]
      → Returns SearchResult[] with project data

   c. buildEvidencePackage(results) → evidence-builder.ts
      → Deduplicates results (by first 100 chars of content)
      → Formats context string: "Project: X\nSection: Technologies\nContent: ..."
      → Truncates to MAX_CONTEXT_CHARS (2000) if needed

   d. runLLMPipeline(messages, evidencePackage)
      → Constructs messages: [system_prompt, retrieved_context, ...chat_history]
      → Streams response from vLLM via SSE
      → Extracts [openProject:slug] actions from LLM output

3. SSE stream → frontend renders tokens, evidence sources, and action buttons.
```

---

# 6. AI Agent Analysis

**YES — this repository implements an AI Agent.**

An AI Agent is defined by three properties: **perception** (receives input), **decision-making** (selects actions), and **action** (executes tools in an environment).

### Evidence

**Perception**: The system receives natural-language user input through two channels — a Python REPL terminal (`agent/publish_agent.py:1137`) and an HTTP POST endpoint (`app/api/chat/route.ts:7-8`).

**Decision-making**: Both systems make autonomous decisions about which tool to invoke based on user intent:

- **Python Agent** (`agent/publish_agent.py:1099-1121`): The LangGraph graph routes messages through a `chatbot` node (LLM decides which tool to call), then a conditional edge (`tools_condition` at line 1115-1117) routes to the `tools` node or `END`. The LLM autonomously selects which of 17 tools to invoke based on the user's natural-language request.

- **TypeScript Agent** (`lib/agent/intent-router.ts:37-89`): The `classifyIntent` function uses regex pre-filtering (greeting patterns) followed by an LLM call to classify the user's message into one of four intents. Based on this classification, the orchestrator either short-circuits with a guardrail response or proceeds to retrieval (`lib/agent/orchestrator.ts:33-104`).

**Action**: Both systems execute side-effecting operations in the Sanity CMS environment — creating, updating, publishing, and deleting documents. The Python agent has 17 distinct tools, and the TypeScript agent has structured GROQ queries plus a semantic search fallback.

**Tool usage** (`agent/publish_agent.py:914-936`): All ds are registered as LangChain `@tool` functions and bound to the LLM. The LLM decides which tool to call, with what arguments, based on the user's natural-language input. This is the hallmark of an AI agent — the LLM is not just generating text; it is orchestrating API calls.

**Autonomy**: The agent operates autonomously within the bounded context of the portfolio management domain. Given "Delete the old YOLOX project", it:
1. Calls `list_projects()` to find matching slugs
2. Identifies the correct project
3. Calls `delete_project(slug)` to delete it and all documentation pages

No human intervention is required between tool calls — the agent chains multiple operations independently.

**Limitations**: The agent does not perform open-ended planning. It follows a simple request-response loop with tool-calling. The spec-driven creation pipeline is mostly deterministic (parse → validate → stage); the LLM is only used as a self-repair fallback.

---

# 7. Agentic AI Analysis

**YES — this repository demonstrates Agentic AI behavior.**

Agentic AI goes beyond simple tool-calling by exhibiting **planning, reasoning, conditional execution, routing, and bounded autonomy**.

### Evidence of agentic behavior

**1. Intent-based routing** (`lib/agent/intent-router.ts:37-89`)

The system classifies each user message into one of four intents (`portfolio`, `greeting`, `out_of_scope`, `ambiguous`) using a two-tier approach:
- **Deterministic pre-filter**: Regex patterns catch obvious greetings (`/^(hi|hello|hey|...)/`)
- **LLM classifier**: A lightweight model classifies remaining messages

Based on intent, the orchestrator takes different execution paths (`lib/agent/orchestrator.ts:33-52`):
```
greeting → yield greeting guardrail → DONE
out_of_scope → yield out-of-scope guardrail → DONE
ambiguous → yield ambiguous guardrail → DONE
portfolio → PROCEED to retrieval pipeline
```

This is **conditional execution** — different execution paths based on a classification decision.

**2. Retrieval strategy selection** (`lib/retrieval/index.ts:7-98`)

The `STRUCTURED_PATTERNS` array implements a **strategy pattern with fallback**:
```typescript
[
  /which projects use\s+(.+)/i           → searchByTechnology(match)
  /(?:what|which).*(?:technology|skill)/ → getSkills() + searchByTechnology("")
  /(?:contact|email|linkedin|github)/    → getContactInfo()
  /(?:resume|cv)/                        → getResumeUrl() || getContactInfo()
  /(?:experience|work history)/          → getExperience()
  /(?:skill|expertise|proficient)/       → getSkills()
  /^open\s+(.+)/i                        → handleNavigation(match)
  /^(?:explain|tell me about|describe)/  → getProjectBySlugFromSanity(query)
  [no match]                             → searchSemantic(fallback to Qdrant)
]
```

This is **reasoning through pattern matching**: the system tries seven structured search strategies before falling back to semantic search. This is not just "call a tool" — it's "determine the optimal retrieval path based on the query's syntactic structure."

**3. Graph execution with checkpointing** (`agent/publish_agent.py:1099-1121`)

The LangGraph graph includes a `MemorySaver` checkpointer, enabling conversation state persistence across turns:
```python
graph_builder.compile(checkpointer=MemorySaver())
```

The REPL increments `thread_id` on `/reset`, creating a new conversation context. This is **bounded autonomy** — the agent maintains state within a conversation but does not persist across sessions.

**4. Tool selection logic in the system prompt** (`agent/publish_agent.py:970-1068`)

The system prompt encodes an elaborate decision tree mapping natural-language phrases to specific tools:

```
"Create"/"Add"/"Make a new project"                     → create_project(data)
"Update X"/"Change the Y of Z"/"Modify"/"Edit"          → update_project(slug, data)
"Publish X"/"Make X visible"/"Put X live"                → publish_project(slug)
"Unpublish X"/"Hide X"/"Take X down"'                    → unpublish_project(slug)
"Delete X"/"Remove X"/"Get rid of X"                     → delete_project(slug)
"List projects"/"What projects do I have?"               → list_projects()
"Sync production to local"/"Pull the latest..."          → sync_production_to_local()
"Deploy my portfolio"/"Promote development to..."         → sync_local_to_production()
"<path> add project considering this spec"               → create_project_from_spec(path)
```

This is **planning expressed through prompt engineering**: the system prompt instructs the LLM how to decompose user intent into a sequence of operations.

### What remains deterministic

- **Spec parsing** (`agent/publish_agent.py:345-424`): The `parse_spec_text` function is pure regex-based deterministic parsing. No LLM involved.
- **Schema discovery** (`scripts/describe-schema.ts:65-75`): `runValidation` executes validation functions against mock Rule objects — purely deterministic.
- **Type coercion** (`agent/publish_agent.py:581-615`): `_coerce_scalar` maps parsed spec values to Sanity types using Python primitives only.
- **Evidence building** (`lib/agent/evidence-builder.ts:28-43`): Deduplication and formatting are deterministic.
- **Chunking** (`scripts/index-content.ts:117-300`): Section-based document chunking is deterministic.

---

# 8. LangChain Analysis

### All LangChain usage locations

| Module | File | LangChain Components |
|--------|------|---------------------|
| Python Agent | `agent/publish_agent.py:22-28` | `ChatOllama`, `StateGraph`, `ToolNode`, `tools_condition`, `MemorySaver`, `SystemMessage`, `ToolMessage`, `@tool` |
| Python Agent | `agent/publish_agent.py:706-728` | `with_structured_output`, `BaseModel`, `create_model` |
| AI Provider | `lib/ai/provider.ts:1-21` | `ChatOpenAI` (LangChain OpenAI adapter pointing at vLLM) |
| Embeddings | `lib/ai/embeddings.ts:1-7` | `HuggingFaceTransformersEmbeddings` |
| Vector Store | `lib/ai/vector-store.ts:1-21` | `QdrantVectorStore` |
| Indexing | `scripts/index-content.ts:11-13` | `QdrantVectorStore`, `Document` |
| Observability | `lib/agent/langfuse-tracer.ts:1-6` | `Langfuse` client |

### Why LangChain was useful

1. **Provider abstraction** (`lib/ai/provider.ts:1-21`): `ChatOpenAI` from LangChain connects to vLLM using the OpenAI-compatible API. This means the vLLM backend can be swapped for OpenAI, Anthropic, or any LangChain-supported provider without changing the orchestration code.

2. **Embeddings abstraction** (`lib/ai/embeddings.ts:1-7`): `HuggingFaceTransformersEmbeddings` provides a standard `Embeddings` interface that any LangChain vector store can consume. Swapping to OpenAI embeddings would be a one-line change.

3. **Vector store abstraction** (`lib/ai/vector-store.ts:1-21`): `QdrantVectorStore` from `@langchain/qdrant` handles the serialization of embeddings storage and similarity search. Switching to Pinecone or Chroma would only require changing the `getVectorStore()` function.

4. **Structured output** (`agent/publish_agent.py:706-728`): `with_structured_output` + Pydantic `create_model` dynamically constrains the LLM's output to only fields that exist in the discovered Sanity schema. This eliminates hallucinated field names — if the schema has no `author` field, the Pydantic model rejects it.

5. **Graph orchestration** (`agent/publish_agent.py:1099-1121`): `StateGraph` + `MessagesState` provides a declarative way to define the agent's execution flow without manual orchestration loops.

6. **Tool decorator** (`agent/publish_agent.py:59`): The `@tool` decorator converts a Python function into a LangChain tool with automatic JSON schema generation from type annotations (e.g., `Annotated[str, "Description"]`).

---

# 9. LangGraph Analysis

### Graph components

The publishing agent uses a single LangGraph graph defined at `agent/publish_agent.py:1099-1121`:

```python
def create_agent():
    llm = ChatOllama(base_url=OLLAMA_URL, model=OLLAMA_MODEL, temperature=0).bind_tools(tools)

    graph_builder = StateGraph(MessagesState)

    def chatbot(state: MessagesState):
        return {"messages": [llm.invoke(state["messages"])]}

    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", ToolNode(tools))

    graph_builder.add_conditional_edges(
        "chatbot", tools_condition, {"tools": "tools", "__end__": "__end__"}
    )
    graph_builder.add_edge("tools", "chatbot")
    graph_builder.set_entry_point("chatbot")

    return graph_builder.compile(checkpointer=MemorySaver())
```

### ASCII graph diagram

```
┌─────────────────────────────────────────────────────────┐
│                     LangGraph Graph                     │
│                                                         │
│   ┌──────────┐                                          │
│   │  __start__│                                         │
│   └─────┬────┘                                          │
│         │                                               │
│         ▼                                               │
│   ┌─────────┐     LLM decides: tool_call?               │
│   │ chatbot │────────────────────────────┐              │
│   │  (LLM)  │                            │              │
│   └────┬────┘                            │              │
│        │                                 │              │
│        │  tool_calls?                    │  no tool_calls│
│        ▼                                 ▼              │
│   ┌─────────┐                     ┌──────────┐          │
│   │  tools  │                     │  __end__  │          │
│   │(ToolNode)│                    │  (return) │          │
│   └────┬────┘                     └──────────┘          │
│        │                                                 │
│        │  ToolMessages returned                          │
│        ▼                                                 │
│   ┌─────────┐                                            │
│   │ chatbot │  (LLM processes tool results)              │
│   └─────────┘                                            │
│                                                         │
│   State: MessagesState (list of messages)               │
│   Checkpointer: MemorySaver (in-memory, per-thread)     │
└─────────────────────────────────────────────────────────┘
```

### Why LangGraph instead of imperative Python

1. **Declarative graph definition**: The execution flow is expressed as nodes and edges rather than imperative while-loops with if-else branches. This makes the control flow auditable and debuggable.

2. **Built-in tool-calling orchestration**: `tools_condition` (`agent/publish_agent.py:1115`) is a LangGraph prebuilt that examines the last AI message for `tool_calls`. If present, it routes to the `tools` node. If not, it routes to `END`. Implementing this manually would require inspecting message objects, checking for tool call attributes, and managing the loop.

3. **State management**: `MessagesState` automatically appends new messages to the conversation history. `MemorySaver` provides thread-level state persistence. These would be manual state-management concerns in imperative Python.

4. **Streaming support**: The `agent.stream()` call (`agent/publish_agent.py:1154`) emits events for each graph node execution. The REPL iterates these events to display intermediate tool results. Manual implementation would require callback mechanisms.

5. **Extensibility**: Adding a new node (e.g., a pre-processing validation node) requires one `add_node` call and an edge definition, rather than restructuring an imperative loop.

---

# 10. Tool Calling

### Complete tool catalog

#### Read-only tools (information gathering)

| Tool | Purpose | Inputs | Outputs | When selected | Location |
|------|---------|--------|---------|---------------|----------|
| `read_file` | Read file from disk | `path: str` | File contents as string | User provides a file path | `agent/publish_agent.py:59-65` |
| `find_markdown` | Discover `.md` files | `directory: str` | Newline-separated file paths | User mentions a directory | `agent/publish_agent.py:68-79` |
| `list_dir` | List directory entries | `path: str` | Newline-separated entries | User explores filesystem | `agent/publish_agent.py:82-91` |
| `list_projects` | List portfolio projects | `search?: str` | JSON project list | "What projects do I have?" | `agent/publish_agent.py:94-109` |
| `read_project` | Read project data | `slug: str` | Full JSON project data | "Show me project X" | `agent/publish_agent.py:112-126` |

#### Lifecycle mutation tools

| Tool | Purpose | Inputs | Outputs | When selected | Location |
|------|---------|--------|---------|---------------|----------|
| `create_project` | Create new project | `project_data: dict` | Success/error message | "Create/Add/Make new" | `agent/publish_agent.py:132-169` |
| `update_project` | Partial update | `slug: str`, `project_data: dict` | Success/error message | "Update/Change/Modify" | `agent/publish_agent.py:172-205` |
| `publish_project` | Toggle visibility ON | `slug: str` | Success/error message | "Publish/Make visible/Put live" | `agent/publish_agent.py:208-222` |
| `unpublish_project` | Toggle visibility OFF | `slug: str` | Success/error message | "Unpublish/Hide/Take down" | `agent/publish_agent.py:225-239` |
| `delete_project` | Delete project + doc pages | `slug: str` | Success/error message | "Delete/Remove/Get rid of" | `agent/publish_agent.py:242-256` |

#### Dataset synchronization tools

| Tool | Purpose | Inputs | Outputs | When selected | Location |
|------|---------|--------|---------|---------------|----------|
| `sync_production_to_local` | Prod → local (read-only) | None | Success/error | "Pull prod changes" | `agent/publish_agent.py:262-276` |
| `sync_local_to_production` | Local → prod (destructive) | None | Success/error | "Deploy/Promote/Ship" | `agent/publish_agent.py:279-294` |

#### Spec-driven creation tools

| Tool | Purpose | Inputs | Outputs | When selected | Location |
|------|---------|--------|---------|---------------|----------|
| `parse_spec_file` | Deterministic spec parser | `path: str` | JSON `{fields, provenance, warnings}` | `<path> add project` (orchestrator calls internally) | `agent/publish_agent.py:447-486` |
| `describe_project_schema` | Discover Sanity schema | None | JSON schema with constraints | `<path> add project` (orchestrator calls internally) | `agent/publish_agent.py:531-544` |
| `create_project_from_spec` | Orchestrate: parse → schema → validate → stage | `spec_path: str` | Staged payload for confirmation | User provides a spec file and says "add" | `agent/publish_agent.py:783-862` |
| `confirm_pending_create` | Write staged project to Sanity | None | Success + audit log path | User says "yes" after reviewing staged payload | `agent/publish_agent.py:865-903` |
| `cancel_pending_create` | Discard staged payload | None | Cancellation message | User says "no" or requests changes | `agent/publish_agent.py:906-911` |

### Tool selection mechanism

The LLM selects tools based on the system prompt's intent-to-operation mapping (`agent/publish_agent.py:970-1072`). The system prompt is effectively a decision tree encoded in natural language. The LLM reads the user's message, matches the phrasing to the intent categories, and emits the corresponding tool call.

Tools communicate results back via `ToolMessage`. The REPL displays truncated tool output (`agent/publish_agent.py:1162-1163`):

```python
print(f"  [{msg.name}] {msg.content[:200]}…")
```

---

# 11. Sanity CMS Integration

### Authentication

**Public reads**: Via the read client (`sanity/client.ts:4-11`) using `projectId`, `dataset`, and `apiVersion` from environment variables. No token needed for published content.

**Write operations**: Via a write client dynamically created by `getWriteClient()` (`scripts/publish-tool.ts:70-88`). Requires `SANITY_API_WRITE_TOKEN` environment variable. Uses `createClient` with `useCdn: false` and the write token.

**CLI operations** (dataset sync): Authenticated by propagating `SANITY_API_WRITE_TOKEN` to `SANITY_AUTH_TOKEN` (`scripts/sync-dataset.ts:51-56`), which the Sanity CLI uses automatically.

### CRUD Operations

| Operation | Implementation | Sanity API |
|-----------|---------------|------------|
| **Create** | `publish-tool.ts:275-315` — validates slug uniqueness, uploads images via `client.assets.upload()`, calls `client.create(doc)` | POST mutation |
| **Read** | `publish-tool.ts:175-205` — GROQ query fetching all project fields, including nested image alt texts | GET query |
| **List** | `publish-tool.ts:207-225` — GROQ with optional `title match` filter | GET query |
| **Update** | `publish-tool.ts:319-367` — verifies slug exists, builds patch object with only changed fields, calls `client.patch(id).set(patchData).commit()` | PATCH mutation |
| **Publish** | `publish-tool.ts:371-386` — `client.patch(id).set({published: true}).commit()` | PATCH mutation |
| **Unpublish** | `publish-tool.ts:390-405` — `client.patch(id).set({published: false}).commit()` | PATCH mutation |
| **Delete** | `publish-tool.ts:409-433` — builds transaction deleting project + all associated `projectDocumentationPage` documents | Transactional delete |

### Dataset synchronization

Uses the Sanity CLI directly (`scripts/sync-dataset.ts:40-102`):

1. `sanity dataset export <source> <tarball>` — exports entire dataset
2. `sanity dataset import <tarball> <dest> --replace` — overwrites destination dataset

The sync is **full-dataset**, not incremental. There is no diffing or selective sync.

### Publishing workflow

The `published` boolean field (`sanity/schemaTypes/project.ts:137-143`) controls visibility:
- `true` (default): Project appears on the public site
- `false`: Hidden from all public queries

Two separate tools toggle this: `publish_project` sets it to `true`, `unpublish_project` sets it to `false`. This is distinct from `create_project` (which sets `published=true` by default) and `sync_local_to_production` (which replaces the entire dataset).

---

# 12. RAG Investigation

**YES — this repository contains a complete RAG (Retrieval-Augmented Generation) pipeline.**

The RAG system is implemented in the TypeScript portfolio chat assistant (`lib/agent/`, `lib/retrieval/`, `lib/ai/`).

### Ingestion

The `scripts/index-content.ts` script handles all content ingestion:

1. **Fetch**: Queries Sanity for all published `project`, `siteSettings`, `experience`, `skillCategory`, and `technicalNote` documents (`scripts/index-content.ts:302-321`).

2. **Fallback**: If Sanity is unconfigured, uses hardcoded fallback content (`scripts/index-content.ts:323-333`).

3. **Chunking**: Each document is split into semantic sections (`scripts/index-content.ts:117-300`):
   - Projects: Chunked by section (Short Summary, Problem Statement, Approach, Results, Limitations, Future Improvements, Technologies, Key Metrics) — each section becomes a separate Document.
   - Experience: Single chunk per role (role + company + description + bullet points + skills).
   - Skills: Single chunk per category (title + skill list).
   - Site settings: Chunked by section (Bio, About, Hero Description, Focus Areas, Contact).

4. **Embedding**: `HuggingFaceTransformersEmbeddings` with model `Xenova/nomic-embed-text-v1.5` (`lib/ai/embeddings.ts:4-7`). Embedding generation happens locally — no API calls.

5. **Indexing**: `QdrantVectorStore.fromDocuments()` stores embedded chunks in the `portfolio_chunks` collection (`scripts/index-content.ts:385-388`).

### Retrieval

The retrieval step in the orchestrator (`lib/agent/orchestrator.ts:54-76`):

1. User query reaches `searchPortfolio(query)` (`lib/retrieval/index.ts:86-98`).
2. Seven structured patterns attempt GROQ-based Sanity queries first.
3. If no pattern matches, falls back to `searchSemantic(query)` (`lib/retrieval/semantic.ts:4-24`).
4. Semantic search: `vectorStore.similaritySearchWithScore(query, k=5)` returns top-5 matching chunks with relevance scores.

### Context construction

The `buildEvidencePackage` function (`lib/agent/evidence-builder.ts:28-43`):

1. **Deduplication**: Removes duplicate chunks (by first 100 characters).
2. **Formatting**: Each chunk is formatted as:
   ```
   Retrieved Portfolio Information:
   Project: <projectTitle>
   Section: <section>
   Content: <actual content>
   ```
3. **Truncation**: If total context exceeds `MAX_CONTEXT_CHARS` (2000), it's truncated with a notice.

### Answer generation

The `runLLMPipeline` function (`lib/agent/llm-pipeline.ts:29-111`):

1. System prompt + retrieved context + chat history (last 10 messages) are sent to vLLM.
2. vLLM streams tokens back via SSE to the frontend.
3. The system prompt (`lib/agent/prompts.ts:1-26`) enforces strict grounding:
   ```
   You MUST base every statement on the retrieved evidence provided.
   Never invent, speculate, or infer information not present in the evidence.
   Never answer from your training data. Only use provided context.
   ```
4. Agent actions (`[openResume]`, `[openProject:slug]`) are extracted from the LLM output via regex and sent as SSE events for the frontend to render as interactive buttons.

---

# 13. Vector Embeddings

### Embedding model

**Model**: `Xenova/nomic-embed-text-v1.5` — a 137M-parameter embedding model from Nomic AI, running locally via HuggingFace Transformers.js (`lib/ai/embeddings.ts:4-7`).

The configurable environment variable is `EMBEDDING_MODEL`.

### Embedding generation

Embeddings are generated in two contexts:

1. **Indexing** (`scripts/index-content.ts:382-388`): Batch generation for all portfolio content chunks via `QdrantVectorStore.fromDocuments()`. This is a one-time operation re-run on content updates.

2. **Query-time** (`lib/retrieval/semantic.ts:5-7`): The user's query is embedded via `vectorStore.similaritySearchWithScore(query, k)`. The `QdrantVectorStore` internally converts the query text to an embedding before performing the vector search.

### Storage

Embeddings are stored in Qdrant (running via Docker, `docker-compose.yml:17-24`), persisted to a Docker volume (`qdrant_data:/qdrant/storage`). The collection name defaults to `portfolio_chunks` (configurable via `QDRANT_COLLECTION` env var).

### Update strategy

**Full re-indexing**: The `scripts/index-content.ts` script recreates the entire collection from scratch on each run. There is no incremental update — this is acceptable given the small document count (a personal portfolio with ~5 projects).

The command is run manually:
```bash
npx tsx scripts/index-content.ts
```

### Retrieval

At query time, `searchSemantic` (`lib/retrieval/semantic.ts:4-24`) calls `vectorStore.similaritySearchWithScore(query, k=5)` which returns the top-5 most similar chunks with cosine similarity scores. The `SearchResult` type includes the score for potential re-ranking, though the current implementation uses Qdrant's native ranking.

---

# 14. Qdrant

### Deployment

Qdrant runs as a Docker service (`docker-compose.yml:17-24`):
```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"   # REST API
    - "6334:6334"   # gRPC API
  volumes:
    - qdrant_data:/qdrant/storage
```

### Collections

A single collection: `portfolio_chunks` (configurable via `QDRANT_COLLECTION`).

### Payload / Metadata

Each document carries Rich payload in the `metadata` field (`scripts/index-content.ts:134-141`):
```typescript
{
  projectTitle: "Video Captioning Agent",
  slug: "video-captioning-agent",
  section: "Problem Statement",
  url: "http://localhost:3000/projects/video-captioning-agent#problem-statement"
}
```

This metadata enriches the `SearchResult` objects returned to the evidence builder, enabling source attribution in the LLM response.

### Similarity search

The `QdrantVectorStore.similaritySearchWithScore` method (from `@langchain/qdrant`) performs:
1. Embed the query text using `HuggingFaceTransformersEmbeddings`.
2. Execute a vector similarity search against the Qdrant collection.
3. Return top-k results with their `pageContent`, `metadata`, and cosine similarity score.

No custom filters are applied in the current implementation — the search is purely semantic.

### Why Qdrant

1. **Local-first**: Qdrant runs in Docker with no cloud dependency. This aligns with the project's constraint of local-only LLM inference.

2. **Rust performance**: Qdrant is written in Rust and optimized for vector operations, providing low-latency search even on consumer hardware.

3. **LangChain integration**: `@langchain/qdrant` provides a `QdrantVectorStore` that integrates directly with LangChain's `Embeddings` interface (line 21 of `lib/ai/vector-store.ts`).

4. **Persistence**: Vector data survives container restarts via Docker volumes.

5. **Open source**: No licensing costs or API limits.

---

# 15. Semantic Search

### What is indexed

All Sanity portfolio content is chunked and indexed in Qdrant:

- **Projects** (published only): Each section (Problem Statement, Approach, Results, etc.) is a separate chunk with project metadata.
- **Site settings**: Bio, About, Focus Areas, Contact — each chunked by section.
- **Experience**: Each role entry with description, bullet points, and skills.
- **Skill categories**: Each category with its skill list.
- **Technical notes** (future): Infrastructure is in place, though no notes existed during initial development.

### How retrieval works

Two-tier retrieval (`lib/retrieval/index.ts:86-98`):

**Tier 1 — Structured GROQ queries (regex-based):**
Seven regex patterns map specific query structures to targeted Sanity GROQ queries. For example:
- "which projects use Python?" → GROQ: `*[_type=="project" && published==true && "Python" in technologies]`
- "contact" / "email" / "linkedin" → GROQ: `*[_type=="siteSettings"][0]{email, linkedinUrl, githubUrl, resumeUrl}`
- "experience" / "work history" → GROQ: `*[_type=="experience"]`

This is more precise than semantic search for known query patterns — it returns exact matches rather than approximate similarities.

**Tier 2 — Semantic search (Qdrant fallback):**
If no regex pattern matches, the query is embedded and compared against all chunks in Qdrant. The top-5 results by cosine similarity are returned.

### Why embeddings instead of keyword search

Embedding-based semantic search handles **paraphrasing and conceptual matching**:

- "What AI tools does he know?" matches chunks about "machine learning", "deep learning", "LangChain" — even if the word "tools" never appears.
- "How does he handle video processing?" matches the Video Captioning Agent project's Approach section, even if the exact phrase "video processing" isn't present.
- Keyword search (SQL LIKE or full-text) would miss these conceptual matches entirely.

### Ranking process

Results are ranked by:
1. **Structured patterns**: If a pattern matches, results are returned directly from Sanity (no scoring).
2. **Semantic**: Qdrant's native cosine similarity ranking — top-5 results by default.
3. **Deduplication**: Identical chunks (by first 100 characters) are removed in `buildEvidencePackage`.
4. **Truncation**: If total context exceeds 2000 characters, content is truncated.

---

# 16. Resume Skills Validation

| Skill | Demonstrated? | Implementation Evidence |
|-------|---------------|------------------------|
| **Generative AI** | YES | `lib/agent/llm-pipeline.ts:29-111` — streaming LLM generates portfolio-grounded responses. `agent/publish_agent.py:731-774` — `_llm_repair` uses structured output for content repair. |
| **Large Language Models (LLMs)** | YES | Two LLM backends: Ollama with `qwen3:4b` (`agent/publish_agent.py:33`), vLLM with `Qwen/Qwen3-4B-Instruct` (`docker-compose.yml:2-15`). Intent classifier uses `qwen2.5:1.5b` (`lib/agent/intent-router.ts:56`). |
| **Prompt Engineering** | YES | System prompt at `agent/publish_agent.py:940-1096` is a 156-line decision tree mapping NLP intents to specific tool calls. Guardrail prompts at `lib/agent/prompts.ts:28-38` handle edge cases. Classification prompt at `lib/agent/intent-router.ts:13-23` defines 4-way intent classification. |
| **Structured Outputs** | YES | `agent/publish_agent.py:706-728` — `_build_payload_pydantic_model` dynamically builds a Pydantic model from the discovered Sanity schema, then calls `with_structured_output()` to constrain the LLM. Pydantic `BaseModel` + `create_model` in `agent/publish_agent.py:728`. |
| **Retrieval-Augmented Generation (RAG)** | YES | Full pipeline: chunking (`scripts/index-content.ts:117-300`), embedding (`lib/ai/embeddings.ts:1-7`), indexing to Qdrant (`scripts/index-content.ts:385-388`), semantic retrieval (`lib/retrieval/semantic.ts:4-24`), context construction (`lib/agent/evidence-builder.ts:28-43`), grounded generation (`lib/agent/llm-pipeline.ts:29-111`). |
| **Semantic Search** | YES | `lib/retrieval/semantic.ts:4-24` — `QdrantVectorStore.similaritySearchWithScore` performs vector similarity search. Seven structured search patterns at `lib/retrieval/index.ts:7-67` with semantic fallback at line 97. |
| **Vector Embeddings** | YES | `lib/ai/embeddings.ts:4-7` — `HuggingFaceTransformersEmbeddings` with `Xenova/nomic-embed-text-v1.5`. Embeddings generated at indexing time (`scripts/index-content.ts:382`) and query time (`lib/ai/vector-store.ts:7`). |
| **AI Agents** | YES | `agent/publish_agent.py:1099-1121` — LangGraph agent with 17 tools, autonomous tool selection, multi-step execution. System prompt encodes decision-making logic for 8+ intent categories. |
| **Agentic AI** | YES | Intent routing with 4-way classification (`lib/agent/intent-router.ts:37-89`), conditional execution paths (`lib/agent/orchestrator.ts:33-52`), multi-strategy retrieval with fallback (`lib/retrieval/index.ts:86-98`), graph-based orchestration with checkpointing (`agent/publish_agent.py:1099-1121`). |
| **LangChain** | YES | Extensive usage across 7 files: `ChatOllama`, `ChatOpenAI`, `HuggingFaceTransformersEmbeddings`, `QdrantVectorStore`, `StateGraph`, `ToolNode`, `tools_condition`, `MemorySaver`, `@tool` decorator, `with_structured_output`, `SystemMessage`, `ToolMessage`. |
| **LangGraph** | YES | `agent/publish_agent.py:1099-1121` — complete `StateGraph` with `MessagesState`, 2 nodes (`chatbot`, `tools`), conditional edges via `tools_condition`, `MemorySaver` checkpointer. |
| **Qdrant** | YES | Docker deployment (`docker-compose.yml:17-24`), collection `portfolio_chunks`, `QdrantVectorStore` for indexing and querying (`lib/ai/vector-store.ts:1-21`, `scripts/index-content.ts:385-388`). |
| **FastAPI** | NO | No FastAPI usage in the repository. The chat API is served by Next.js App Router (`app/api/chat/route.ts`). The agent REPL is a plain Python `while True` loop with `input()`. |
| **Docker** | YES | `docker-compose.yml` defines 3 services: vLLM (line 2-15), Qdrant (line 17-24), MLflow (line 26-43). Each uses named Docker volumes for persistence. |
| **PostgreSQL** | NO | No PostgreSQL usage. MLflow uses SQLite (`mlruns.db`). Qdrant uses its own storage engine. Sanity is a hosted content lake. |

---

# 17. Interview Preparation

### Explain this project in 2 minutes

"I built an AI-powered portfolio management system with two autonomous agents. The first is a Python LangGraph agent that manages the full lifecycle of Sanity CMS projects — creating, reading, updating, publishing, and deleting — all through natural language. It has 17 tools that shell out to TypeScript bridges for Sanity mutations. The second is a RAG-powered portfolio chat assistant that answers visitor questions by combining structured GROQ queries with semantic search over Qdrant. Content is chunked, embedded locally using HuggingFace Transformers, and served by vLLM with strict evidence grounding. The system is fully observable with MLflow experiment tracking and Langfuse tracing. Both agents run entirely on local infrastructure — no cloud LLM APIs."

### Explain the problem statement

"Managing a Sanity CMS portfolio manually requires navigating a headless CMS UI for every content change. Adding a project means filling 15+ form fields, uploading images through a separate pipeline, and manually toggling visibility. This is repetitive, error-prone, and not automatable. The agent replaces all of that with natural language — you say 'Add this project' with a structured Markdown spec, and the agent does the rest, including image uploads, slug validation, schema discovery, and a human confirmation gate."

### Why build an AI Agent?

"Because the domain has well-defined operations (CRUD + publish/unpublish + sync) but the user shouldn't need to know the exact operation name or syntax. An AI agent maps natural-language intent to structured tool calls. The LangGraph graph handles the orchestration — tool selection, execution, and response synthesis — without me writing imperative control flow. It's also extensible: adding a new tool just means defining a function and adding it to the tools list."

### Why LangChain?

"LangChain provides the provider-agnostic abstraction layer. I use ChatOpenAI to talk to vLLM, but I could switch to Anthropic or actual OpenAI by changing one line. HuggingFaceTransformersEmbeddings could become OpenAIEmbeddings with zero code changes downstream. The QdrantVectorStore integrates with any Embeddings implementation. The @tool decorator auto-generates JSON schemas from type annotations. And with_structured_output + Pydantic constrained the LLM's output to only valid schema fields."

### Why LangGraph?

"LangGraph gives me declarative graph execution — I define nodes and edges, not a while-true loop with nested conditionals. The built-in tools_condition handles the tool-call routing automatically. MemorySaver provides thread-level conversation persistence. And agent.stream() gives me streaming events per node execution, which I use to display intermediate tool results in the REPL. If I ever need to add a pre-processing node — say, a content validation step — it's one add_node call and an edge, not a restructuring of imperative code."

### Why not plain Python?

"A plain Python while-true loop with manual JSON parsing of tool calls would work for simple cases. But it wouldn't give me: (1) automatic message history management (LangGraph's MessagesState), (2) streaming per-node execution events, (3) built-in tool call parsing and routing (tools_condition), (4) thread-level state persistence (MemorySaver), (5) easy extensibility to multi-agent graphs. LangGraph solves all of these declaratively, and the code is more maintainable as a result."

### Why Qdrant?

"Qdrant is the best-fit vector database for local-first deployment. It runs in Docker alongside vLLM and MLflow, uses Rust for performance, persists data via volumes, has excellent LangChain integration through @langchain/qdrant, and is fully open-source. Alternatives like Pinecone are cloud-only, and Chroma/FAISS lack the production-readiness that Qdrant provides out of the box."

### How does retrieval work?

"The orchestrator first tries seven regex-based structured patterns. Each pattern maps a specific query shape to a targeted Sanity GROQ query — for example, 'which projects use Python?' becomes `*[_type=="project" && published==true && "Python" in technologies]`. This is precise and fast. If no pattern matches, we fall back to semantic search: the query is embedded with HuggingFace Transformers, and Qdrant returns the top-5 most similar chunks by cosine distance. The results are deduplicated, formatted with project metadata, truncated to 2000 characters, and injected into the LLM context alongside the system prompt and conversation history."

### Why is this Agentic AI?

"Because the system exhibits autonomous decision-making in multiple layers. The intent router classifies user queries into four categories and takes different execution paths for each — short-circuiting on greetings, redirecting on out-of-scope, and proceeding to retrieval on portfolio queries. The retrieval layer selects among seven strategies based on query structure. The publishing agent autonomously chains tool calls — like listing projects to find a slug, then calling update on it — without human intervention between steps. This is not just 'LLM → response'; it's 'LLM → reason → select tool → execute → observe result → respond.'"

### How would you scale it?

"For the publishing agent: replace the in-memory MemorySaver with a PostgreSQL-backed checkpointer for persistence across restarts. Add user authentication so multiple editors can use the agent simultaneously. Replace the REPL interface with a FastAPI endpoint so the agent becomes a microservice.

"For the chat assistant: implement hybrid search (combine keyword BM25 with vector similarity for better precision-recall). Add re-ranking with a cross-encoder for better result ordering. Implement incremental indexing triggered by Sanity webhooks instead of manual re-runs. Add a caching layer for frequent queries. Switch to a more powerful embedding model like intfloat/e5-large-v2 if more nuanced retrieval is needed.

"For infrastructure: move from Docker Compose to Kubernetes for production orchestration. Add a reverse proxy (nginx/traefik). Set up monitoring with Prometheus/Grafana for Qdrant and vLLM metrics."

### Biggest engineering challenge

"The spec-driven creation pipeline required making schema discovery work in live TypeScript imports. The Sanity schema has validation functions like `Rule.required().uri({scheme: ['http', 'https']})`. Rather than maintaining a separate schema definition, I built a system that imports the actual Sanity schema, executes validation functions against a JavaScript Proxy that records method calls, and extracts field names, types, and constraints from the recorded calls. This means adding a new field to the Sanity schema — with its validation — automatically flows through to the agent with zero code changes."

### Biggest design decision

"Separating the agent into two layers — Python for decision-making and TypeScript for Sanity I/O — was the key architectural decision. The Python layer uses LangGraph and tool-calling for orchestration, which is the best ecosystem for that. The TypeScript layer uses the existing Sanity client, types, and GROQ queries from the Next.js codebase. Neither layer's strengths are compromised. The bridge is through subprocess calls (`npx tsx script.ts`), which is admittedly not the most efficient IPC, but it keeps the Python agent completely decoupled from TypeScript build tooling and session management."

### Future improvements

"1. **Incremental indexing**: Trigger Qdrant re-indexing from Sanity webhooks instead of manual runs.
2. **Multi-modal search**: Index project cover images and architecture diagrams for visual similarity search.
3. **Agent memory**: Add long-term memory for user preferences (e.g., 'always publish immediately').
4. **Multi-agent graph**: A supervisor agent that routes between the publishing agent and the chat assistant based on user intent.
5. **FastAPI endpoint**: Replace the REPL with a REST API so the publishing agent can be triggered from CI/CD pipelines.
6. **Hybrid search**: Combine BM25 keyword search with vector similarity for better retrieval precision.
7. **Documentation page generation**: Extend spec-driven creation to also generate `projectDocumentationPage` documents from the spec's detailed sections.
8. **Granular dataset sync**: Selective sync (by project slug) instead of full-dataset replacement."

---

*Report generated from repository analysis at `/home/aditya/dev-work/portfolio/ai_engineer`. All conclusions based on source code inspection. File paths are relative to the repository root.*
