# Aditya More — Applied AI Portfolio & Multi-System Content Platform

An AI-engineer's self-built portfolio website that pairs a CMS-driven site with an evidence-grounded RAG chat assistant, a natural-language publishing agent, and a transactionally-safe vector indexing pipeline.

---

# At a Glance

| | |
|---|---|
| Status | Production-oriented personal platform — website is deployable to Vercel; assistant runs on local LLM + Qdrant; indexing layer is hardened to production-grade |
| Role | Sole Designer & Developer (all 30 commits authored by `adityadmore2000`) |
| Domain | AI Agents · RAG · Applied AI · Developer Tooling |
| Tech Stack | Next.js 15 (App Router, ISR), TypeScript, Sanity CMS, Qdrant, LangChain, Ollama / vLLM, Python + LangGraph, Langfuse, MLflow, Docker Compose |
| Interfaces | Public portfolio site · SSE streaming chat API (`POST /api/chat`) · embedded Sanity Studio (`/studio`) · Python REPL publishing agent · 13 TypeScript CLI bridge scripts |

---

# Key Highlights

- **Retrieval-first RAG assistant** — replaced a LangGraph ReAct agent with a deterministic pipeline (intent classify → mandatory retrieval → evidence build → single streaming LLM call), moving all policy out of the LLM and into application code (`docs/architecture/streaming-refactor-plan.md`).
- **Two-tier retrieval** — 8 regex patterns route common queries ("which projects use Python?") to deterministic GROQ handlers against Sanity; novel queries fall back to Qdrant semantic search, then to a grounded LLM answer.
- **Provider-agnostic observability** — a hand-rolled `ObservabilityService` interface with Langfuse and no-op implementations isolates the agent layer from any tracing vendor; Langfuse is confined to one file.
- **Transactional vector indexing** — a blue-green, application-level transaction manager that builds the Qdrant index into a temp collection, validates it (count, dimensions, semantic retrieval probes), and atomically promotes it via Qdrant aliases — production search is never partially rebuilt and never unavailable.
- **Crash recovery + single-writer lock** — a filesystem journal persists every transaction state; on restart, incomplete transactions are aborted/resumed and orphaned temp collections swept, with a stale-lock-aware single-writer guard.
- **Schema-aware publishing agent** — a Python LangGraph agent that manages the full project lifecycle in natural language, including deterministic spec-driven project creation that discovers the live Sanity schema by executing validation functions against a mock `Rule` (no hardcoded field list).
- **Six forensic investigation reports (~3,400 lines)** committed to the repo documenting root-cause analysis of a 3-bug runtime failure chain, a stale-index hypothesis falsification, and a semantic search ranking analysis.

---

# Why I Built It

The project is a portfolio for an Applied AI Engineer, and its architecture doubles as the demonstration. The site is not just a resume — it is a live example of the domains the owner claims to work in: RAG, AI agents, observability, and reliable AI pipelines. Rather than a static site with a canned chatbot, the owner built the portfolio **as the product**:

- a content model (`sanity/schemaTypes/project.ts`) that encodes a storytelling hierarchy (Hero → Why I Built It → Problem → Solution → Engineering Decisions → Challenges → Results) — a deliberate UX/content-engineering decision, not default CMS boilerplate;
- a chat assistant that must answer questions about itself correctly, forcing grounding and evaluation discipline;
- a publishing agent so content can be managed conversationally instead of through Studio forms.

The engineering motivation is partly inferable from the code itself (the AGENTS.md and schema are carefully designed), but the original personal motivation is not fully recoverable from repository evidence.

> This section requires author input for the personal backstory; repository evidence reveals the *what* and *how* in detail but not the original motivating spark.

---

# The Problem

Three related engineering problems:

1. **A portfolio that must be maintainable and truthful.** Content lives in Sanity (a headless CMS with no custom backend). Every content change currently requires the Studio UI, structured form-filling, image uploads, and CLI dataset syncs — multi-step and error-prone (`docs/repository_analysis.md`).

2. **Recruiters need fast, accurate answers.** A visitor wants "what did you build with computer vision?" answered in seconds with citations — not a crawl through long pages. A chatbot over LLM-only knowledge would hallucinate about the owner; a plain keyword search couldn't handle natural language.

3. **A vector index that must not silently corrupt.** The first indexing implementation appended documents on every run (a confirmed bug in `QdrantVectorStore.fromDocuments()` — `RAG_Stale_Vector_DB_Investigation.md`), producing duplicate vectors and stale search results. Re-indexing was an unsafe, all-or-nothing mutation of the live search index.

---

# What I Built

A single repository containing four cooperating systems:

1. **Portfolio website** — Next.js 15 App Router with ISR (`revalidate = 60`), Sanity Content Lake as the only data source, embedded Sanity Studio, per-project documentation pages with fumadocs navigation, draft/preview mode, on-demand revalidation, and image lightbox with pan/zoom.

2. **Evidence-grounded chat assistant** — a floating chat panel that answers portfolio questions with citations. Workflow: ask "Which projects use computer vision?" → the system classifies intent, retrieves structured data or vector matches, assembles a ≤2000-char evidence package, and streams the answer token-by-token over SSE, then attaches `evidence` sources and UI actions (`[openProject:slug]`, `[scrollTo:section]`, `[openResume]`) to the message.

3. **Natural-language publishing agent** — a Python LangGraph REPL that interprets commands like *"Update the results section of warehouse-parcel-monitoring-system"* or *"`/home/me/foo.md` add project considering this spec"*. It shells out to 13 TypeScript bridge scripts that perform Sanity mutations (create/update/publish/unpublish/delete), dataset sync (production ↔ local), and schema discovery.

4. **Transactional index pipeline** — `npm run index-content` rebuilds the semantic index from Sanity content as an atomic, validated, recoverable transaction rather than a destructive in-place rebuild.

---

# System Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │                 Sanity CMS                   │
                          │   project · experience · skillCategory ·     │
                          │   siteSettings · technicalNote · docPages    │
                          └───────┬──────────────────────────┬───────────┘
                                  │ GROQ (CDN read)           │ write (agent)
                 ┌────────────────┼───────────────────────────┼──────────┐
                 ▼                ▼                           ▼          │
        ┌────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐
        │  Portfolio Web  │  │  RAG Chat Assistant     │  │ Publishing Agent │
        │  (Next.js ISR)  │  │  POST /api/chat ──►     │  │ (Python LangGraph│
        │                 │  │  orchestrator.ts        │  │  + 13 TS bridges)│
        └────────────────┘  │   │                     │  └──────────────────┘
                            │   ▼                     │           │ reindex trigger
                            │  classifyIntent()       │           ▼
                            │   (regex fast path →    │  ┌─────────────────────┐
                            │    LLM)                 │  │ IndexTransactionMgr │
                            │   ▼                     │  │ journal + lock +    │
                            │  searchPortfolio()      │  │ temp collection →   │
                            │   ├─ 8 regex→GROQ (T1)  │  │ validate → alias    │
                            │   └─ Qdrant semantic    │  │ promote → cleanup   │
                            │        (T2, alias-aware)│  └─────────┬───────────┘
                            │   ▼                     │            ▼
                            │  buildEvidencePackage() │   ┌────────────────┐
                            │   (dedup · format ·     │   │   Qdrant        │
                            │    ≤2000 chars)         │   │  production    │
                            │   ▼                     │   │  = ALIAS       │
                            │  runLLMPipeline() ──►   │   │  → backing col │
                            │   SSE token stream      │   └────────────────┘
                            └────────┬────────────────┘
                                     ▼
                            Langfuse / MLflow (best-effort)
                            ObservabilityService interface
```

**Key components:**

- **Orchestrator (`lib/agent/orchestrator.ts`)** — an `AsyncGenerator` that sequences intent → retrieval → evidence → generation and emits typed SSE events. Early exits for greeting / out-of-scope / ambiguous / no-evidence produce guardrail responses without ever touching retrieval or the LLM for portfolio synthesis.
- **Intent router (`lib/agent/intent-router.ts`)** — two-layer classification: regex fast-path for greetings (~1ms, zero LLM cost) and a lightweight LLM for everything else, with `ambiguous` as an explicit outcome (never silently treated as a portfolio query).
- **Retrieval (`lib/retrieval/`)** — Tier 1 is a deterministic router of 8 regex patterns to hand-written GROQ handlers (skills, experience, contact, resume, project-by-slug, technology lookup). Tier 2 is Qdrant cosine similarity (k=5). First non-empty result set wins.
- **Evidence builder (`lib/agent/evidence-builder.ts`)** — a pure function that deduplicates by first 100 characters, formats results with project/section labels, and truncates to 2,000 characters with an explicit truncation notice.
- **LLM pipeline (`lib/agent/llm-pipeline.ts`)** — a single streaming call against an OpenAI-compatible server (vLLM or Ollama). The system prompt enforces grounding ("never answer from training data"), evidence is injected as a separate system message to keep the prompt cacheable, and the last 10 messages are carried as history.
- **Observability (`lib/observability/`)** — `ObservabilityService` interface with `LangfuseObservabilityService` and `NoopObservabilityService`. All tracing is manual (explicit span/generation handles); a `Promise.race` flush with a timeout ensures tracing can never hang a user response. A parallel `MLflowLogger` wraps the MLflow REST API with in-memory staging, batch flushing, and experiment auto-creation.
- **Index transaction manager (`lib/indexing/transaction/manager.ts`)** — the state machine at the heart of the data pipeline (see below).

---

# Why This Architecture?

## Retrieval-first over agent-first

The most consequential decision. Revision 2 of the refactor plan still used a *bounded* LangGraph agent; Revision 3 removed it entirely. Rationale, from the plan: once retrieval is mandatory and tools are deterministic lookups of data already in the evidence context, a ReAct loop adds no value — "the single task is: given evidence, answer the question." The result is one LLM call instead of 2–3 per turn, no tool-selection autonomy, and far easier debugging. The LLM synthesizes; the application owns policy. This is an architecture where correctness is enforced structurally, not by prompt.

## Structured-then-semantic retrieval

Two tiers are complementary. Regex→GROQ gives deterministic, exact answers for the high-frequency query types (skills, contact, experience) with zero LLM and zero vector-search cost, plus stable URLs and formatting. Semantic search covers novel phrasing. The first non-empty tier wins, so common questions never depend on embedding quality. Tradeoff: the structured tier is brittle to phrasing it wasn't written for (documented below in Challenges).

## Blue-green transactional indexing

The vector index is a deterministic projection of Sanity, but rebuilding it used to be an unsafe in-place mutation. The transaction manager reimplements the guarantees a database gives you: build into a scratch collection (`portfolio_temp_txn_<id>`), validate, then switch the stable name via Qdrant aliases — the equivalent of a blue-green deploy for a vector index. Production search never sees a partial build and never disappears. This is an unusual level of rigor for a personal portfolio and mirrors production-grade deployment thinking.

## Application-level state machine + journal recovery

Because the "transaction" spans multiple Qdrant API calls (create, upsert, validate, alias-swap), true atomicity isn't available from Qdrant. The manager therefore implements a persisted state machine: `building → validating → promoting → committed` (or `failed/aborted`), journaled as JSON to `.state/index-transactions/` at each step. On restart, `recover()` inspects the journal, resumes a promotion if the alias actually applied, otherwise aborts and discards the temp collection, then sweeps orphaned temp collections. Combined with a filesystem single-writer lock (with stale-lock breaking by dead-PID or age), this gives crash safety and mutual exclusion that the naive implementation lacked.

## Provider abstraction everywhere

LLM (Ollama/vLLM/OpenAI-compatible), embeddings (Ollama/OpenAI, HuggingFace deprecated), and observability (Langfuse/no-op) are all behind factory functions or interfaces. The environment-file design documents this explicitly: "The application never catches observability exceptions." Every subsystem degrades gracefully when unconfigured — a defensive posture that lets the whole platform run without API keys.

---

# Engineering Decisions

## Decision: Single direct LLM call instead of a ReAct agent
- **Why** — mandatory pre-retrieval makes tool-calling redundant; the plan documents "simpler, faster, and more debuggable."
- **Benefits** — deterministic control flow, lower latency, no tool-failure modes.
- **Tradeoffs** — the assistant cannot search for follow-up information beyond the initial evidence; conversation history must carry context.

## Decision: Manual tracing instead of LangChain callback handlers
- **Why** — documented as incompatible with the manual trace approach in Langfuse v5 and giving full control over span contents (`orchestration-layer.md`).
- **Benefits** — no dependency on framework callback plumbing; precise ownership of each span.
- **Tradeoffs** — explicit `startSpan()`/`end()` calls at every stage; token counts must be extracted manually from stream `usage_metadata`.

## Decision: Deterministic spec parsing with one constrained LLM self-repair fallback
- **Why** — the publishing agent is "a schema-aware mapper, never an author" (AGENTS.md); determinism is the happy path.
- **Benefits** — spec content is copied verbatim (no rewriting/invention); the LLM can only emit fields that exist on the discovered schema (Pydantic model built from the live schema).
- **Tradeoffs** — the spec grammar is rigid; free-form descriptions are not supported.

## Decision: Schema discovery by executing validation functions against a mock `Rule`
- **Why** — makes the Sanity schema the single source of truth: add/rename/require a field in `project.ts` and the agent adapts on next call, cached by mtime.
- **Benefits** — no parser/prompt/validation drift when the CMS evolves; `describe-schema.ts` prints a normalized JSON schema by proxy-instrumenting Sanity's validation chain.
- **Tradeoffs** — requires the schema to be statically importable in the bridge script.

## Decision: Section-based deterministic chunking (no LangChain splitters)
- **Why** — clean, predictable chunks at known story-section boundaries, each with URL and slug metadata for citation links.
- **Benefits** — provenance-friendly (chunks map to page anchors); deterministic re-runs.
- **Tradeoffs** — experience entries are one monolithic chunk per job; proper nouns like a company name carry weak signal relative to shared ML/AI vocabulary (a documented retrieval failure).

## Decision: Alias-aware Qdrant client via a `Proxy` wrapper
- **Why** — the stable `QDRANT_COLLECTION` name becomes an alias after promotion; LangChain's `ensureCollection()` only checks real collections and would wrongly try to recreate an alias.
- **Benefits** — application code stays permanently decoupled from physical collection names.
- **Tradeoffs** — a small amount of indirection in the vector store; relies on `getAliases()`.

## Decision: Atomic legacy→alias migration via Qdrant's batch operations endpoint
- **Why** — converting a pre-existing real collection to an alias must be a single server-side call (delete + create alias) so search availability is never interrupted; falls back to sequential delete-then-alias only if the endpoint is unavailable.
- **Benefits** — zero-downtime migration from the legacy real collection to the alias model.

---

# Interesting Engineering Challenges

## Challenge 1 — The 17-minute failure chain

### Problem
Every chat request failed: vLLM crash-looped on a no-GPU host, `ChatOpenAI` was created with default retries, so LangChain's exponential backoff (1s + 2s + … + 512s) produced a ~17-minute hang, and an imported-but-never-instantiated `LangfuseTracer` threw `ReferenceError` at six call sites. Three independent bugs stacked into one unrecoverable request path.

### Solution
Runtime instrumentation traced the chain end-to-end (`Runtime_Request_Trace_Investigation.md`); the fix (`Runtime_Fix_Report.md`) added explicit `timeout: 180000`, `maxRetries: 1`, `maxTokens: 4096`, instantiated the tracer, and added a `CHAT_BASE_URL` resolution fallback that let the environment switch from vLLM to Ollama.

### Outcome
Greeting responses went from ~17-minute hangs to ~0ms via the regex fast path; LLM failures now fail in 3 minutes instead of 17. This chain is documented with source-code citations and a root-cause matrix.

## Challenge 2 — Semantic search silently never worked

### Problem
The embedding path defaulted to HuggingFace, which dynamically imports `@huggingface/transformers` — a package missing from `package.json`. Every semantic query threw `ERR_MODULE_NOT_FOUND`, silently caught by the retriever's try/catch, so users got "I couldn't find that information" with no signal of the real failure.

### Solution
A dependency audit (`Semantic_Search_Investigation.md`) identified the missing package; the fix deprecated the HuggingFace provider and added an `EMBEDDING_PROVIDER` switch to Ollama and OpenAI embeddings.

### Outcome
Semantic search became functional and provider-selectable; the deprecation path now throws an explicit error telling the user which env var to set instead of failing silently.

## Challenge 3 — Proper-noun dilution in vector search

### Problem
Querying "What did you do at Neilsoft?" failed even with working embeddings. The experience chunk is one ~85-word vector where the company name appears once; shared ML/AI vocabulary dominates, and with k=5 the chunk ranked 6th+ in its own neighborhood.

### Solution
Vector-neighborhood analysis proved the ranking problem (`Semantic_Search_Investigation.md`), and pattern-gap analysis (`RAG_Debug_Report.md`) mapped all 8 structured patterns against the failing queries — none matched a company-name query.

### Outcome
The root causes were isolated to chunking granularity + structured pattern coverage (not a stale database — a rival hypothesis falsified by comparing production ≡ local ≡ Qdrant byte-for-byte). The repository documents the fix paths; the transactional re-index and finer chunking remain the natural remedies.

## Challenge 4 — Re-indexing corrupted the search index

### Problem
`QdrantVectorStore.fromDocuments()` creates the collection only if absent and always appends — so every `index-content` run duplicated vectors (26 → 52 → 78). Old vectors were indistinguishable from new (no version metadata).

### Solution
This is the problem the transactional layer was built to solve: each run builds into a fresh temp collection, so duplication is impossible, and the old backing collection is deleted only after the new one is validated and promoted.

### Outcome
Re-indexing became idempotent and safe: failed builds never touch production, promotion is a single alias-swap call, and a content `sanityRevision` (sha256) is recorded so index↔content provenance is traceable.

## Challenge 5 — Observed behavior of "ambiguous" intent and classification latency

### Problem
Intent classification used a thinking-capable model with measured latency of 11–65s per call — the pipeline bottleneck — and the output parser used substring matching, so a semantically-correct but schema-invalid label silently degraded to `ambiguous` (`Intent_Router_Investigation.md`).

### Solution
Diagnosed via forensics on a returning `ambiguous` result; the router was migrated to `getIntentModel()` with a strict valid-intent set, and errors log structured diagnostics.

### Outcome
The failure mode is now explicit and observable rather than silent; remaining latency depends on the local model's thinking phase.

---

# Project Evolution

Git history shows a clear maturation arc over ~2 months:

- **Jun 2026** — Static-to-CMS: initial Next.js + Sanity site, fumadocs documentation pages, custom Portable Text blocks (Mermaid, callouts, tables), lightbox, draft mode, on-demand revalidation.
- **Jul 2026** — Agentic expansion: experiment harness with MLflow, dataset sync tools, spec-driven project creation with dynamic schema discovery; then the chat assistant (LangChain + Qdrant + Ollama), immediately refactored to the retrieval-first streaming pipeline (LangGraph removed), vLLM adoption, observability (MLflow → Langfuse → provider-agnostic interface), intent-router bug fix, and embedding provider fixes.
- **Aug 2026** — Hardening: the monolithic `index-content.ts` was modularized into `lib/indexing/*`, then the transactional manager, journal, single-writer lock, and semantic validation were added on top — directly addressing the vector-accumulation bug documented weeks earlier.

The `RAG_*` investigation reports (dated ~Jul 27) read as the debugging backlog that motivated the August transactional work; the reports themselves were committed to the repo as evidence of the diagnostic process.

---

# Results

**Measurable (from committed reports and seed data):**
- Greeting time-to-first-token: ~17 min → ~0ms (regex fast path).
- LLM failure timeout: ~1,023s (exponential backoff) → 180s + 1 retry.
- Model evaluation (portfolio content): 92.7% precision, 95.0% recall, 97.4% mAP50 on parcel detection (from Sanity seed data, representing the owner's prior CV work).
- Validation: TypeScript typecheck passes; ESLint 0 errors (reported).
- Index metrics: 26 vectors, 768-dimensional, cosine distance (pre-transactional baseline; ~57 chunks estimated in content).

**Functional outcomes:**
- Full project lifecycle (create/read/update/publish/unpublish/delete) is now conversational; dataset sync is one natural-language command.
- Re-indexing is idempotent, validated, recoverable, and single-writer — a documented defect was eliminated, not patched.
- The chat assistant is grounded by construction: no evidence → explicit "couldn't find" response; intent boundaries enforced in application code.

---

# Technologies

| Category | Technology |
|---|---|
| Languages | TypeScript, Python |
| Frameworks | Next.js 15 (App Router, ISR, Route Handlers), React 19, Tailwind CSS 4, LangChain (core/openai/ollama/qdrant), LangGraph |
| CMS & Data | Sanity CMS (Content Lake, GROQ, embedded Studio), Portable Text, sanity-plugin-markdown |
| AI / Retrieval | Qdrant (vector DB, aliases), Ollama, vLLM, OpenAI-compatible APIs, deterministic chunking, SSE streaming |
| Observability | Langfuse, MLflow, Vercel Analytics, custom `ObservabilityService` interface |
| Infrastructure | Docker Compose, Vercel, ESLint, `tsx`, Zod, fumadocs |
| Agent tooling | Python LangGraph, `bind_tools`, Pydantic structured output, 13 TypeScript CLI bridges, custom spec parser |

---

# What This Project Demonstrates

- **RAG system design** — retrieval-first architecture, two-tier structured/semantic retrieval, evidence-budget management, grounding enforcement at the application layer rather than by prompt.
- **AI agent tooling** — a working multi-tool agent with deterministic schema-aware mapping, live schema discovery, and a human confirmation gate.
- **Data engineering / transactional systems** — blue-green index promotion, a persisted state machine with crash recovery, single-writer locking, stale-lock breaking, and provenance tracking. This is distributed-systems thinking applied to a vector store.
- **Observability engineering** — a provider-agnostic tracing abstraction, manual span/generation instrumentation, token accounting, and fail-open/no-op behavior throughout.
- **Production hygiene** — environment-policy enforcement (secrets, dev commands), graceful degradation when unconfigured, investigative debugging with committed root-cause reports, and architecture plans with risk matrices and migration strategies.
- **Full-stack ownership** — from CMS schema design and Next.js rendering to Python orchestration and TypeScript CLI tooling, all in one coherent system.

---

## Tradeoffs

| Decision | Tradeoff |
|---|---|
| Retrieval-first (no agent loop) | Assistant cannot search beyond initial evidence; history must carry context |
| Structured patterns before semantic search | Brittle to unanticipated phrasing (e.g., company-name queries) |
| Manual tracing | Explicit instrumentation at every stage; no framework auto-instrumentation |
| Monolithic experience chunks | Weak proper-noun signal in embeddings |
| Rigid spec grammar | No free-form project description input |
| Single-writer lock | Suitable for single-agent workflow; needs a real lease mechanism before concurrent API-driven publishing (noted in AGENTS.md) |

## Failure Recovery

The transactional indexing layer is the flagship: journaled states, `recover()` abort/resume on restart, orphaned-collection sweep, and a stale-lock-breaking single-writer guard. Failed builds never reach production. This was purpose-built after the append-duplication defect was documented.

## Security Considerations

- Secrets policy enforced in AGENTS.md: agents must not read `.env*` unless instructed; tokens never committed (`.env*` gitignored).
- Observability keys are runtime-only; tracing is disabled (no-op) when unset.
- Sanity write operations require an explicit `SANITY_API_WRITE_TOKEN`; read path uses CDN client with published perspective only.

## Observability

Langfuse traces (one trace per request: intent-classification span, retrieval span, evidence span, chat-generation generation) plus MLflow runs as independent side-effects; both best-effort and fail-open. Token accounting and duration are captured per generation. A 2s flush timeout protects response latency.

---

## Notes on Evidence & Accuracy

This case study sticks to repository evidence. The "measured" latency/vector figures come from committed investigation reports of the state at the time; the transactional indexing layer landed after those reports, so live metrics for it (transaction durations, promotion times) are not recorded in the repo. The documented bugs (silent semantic failures, monolithic chunks) may still be partially present in the retrieval path even though the indexing path is now transactionally safe.
