# Repository Analysis Report

## 1. Project Overview

**Project name**: Aditya More AI Portfolio

**One-paragraph summary**: A dual-system AI-powered portfolio platform. System 1 is a Next.js portfolio website with built-in Sanity CMS that showcases projects, experience, and skills. System 2 is a Retrieval-Augmented Generation (RAG) chatbot that answers natural-language questions about the portfolio via a chat interface at `/api/chat`. A separate Python publishing agent (`agent/publish_agent.py`) manages CRUD operations on Sanity CMS project documents through natural language commands.

**Primary objective**: Automate portfolio content management and provide natural-language Q&A over portfolio data.

**Target users**: Recruiters, collaborators, and the portfolio owner (for content management).

**Current maturity**: MVP/Prototype. The RAG pipeline has multiple known blocking bugs (undefined variable ReferenceError, missing dependency preventing semantic search from ever executing, LLM unreachable due to no-GPU host). The publishing agent is functional but marked as a Python-based system outside the main TypeScript codebase.

---

## 2. Problem Being Solved

**Why this project exists**: The portfolio owner (Aditya More) maintains a Sanity CMS-backed portfolio website. Without the agent, every content change requires navigating Sanity Studio UI, manually filling structured forms, uploading images through Sanity's asset pipeline, and running CLI commands to synchronize local vs production datasets. This is multi-step and error-prone.

**Engineering constraints identified**:
- Sanity Content Lake is the single source of truth (no custom backend). Evidence: `AGENTS.md` line 19: "No custom backend — Sanity Content Lake is the only data source".
- Local LLM only (Ollama / vLLM); no cloud API calls for LLM inference. Evidence: `lib/ai/provider.ts` defaults to `localhost:8000/v1`.
- All infrastructure runs via Docker Compose (Qdrant, vLLM, MLflow). Evidence: `docker-compose.yml`.
- Agents must degrade gracefully when unconfigured. Evidence: `lib/observability/service.ts` returns `NoopObservabilityService` when env vars are missing.
- Deterministic spec-parsing for project creation (no LLM content generation). Evidence: `AGENTS.md` lines 121-135: "Happy path is fully deterministic... LLM is only a self-repair fallback".

---

## 3. High-Level Architecture

The repository contains two largely independent subsystems plus a portfolio website:

### Subsystem 1: Portfolio Website (Next.js + Sanity)
```
app/page.tsx → React components → Sanity GROQ queries → Sanity Content Lake
                                                         ↓
                                              scripts/index-content.ts → Qdrant
```

### Subsystem 2: RAG Chat Assistant
```
POST /api/chat → route.ts → orchestrator.ts → intent-router.ts
                                                  ↓
                                          searchPortfolio()
                                              ├─ structured patterns (regex → Sanity GROQ)
                                              └─ semantic fallback (Qdrant + embeddings)
                                                  ↓
                                          evidence-builder.ts
                                                  ↓
                                          llm-pipeline.ts → streaming SSE response
```

### Subsystem 3: Publishing Agent (Python)
```
agent/publish_agent.py → (shells out to) scripts/{create,update,delete,...}-project.ts
                                                         ↓
                                                scripts/publish-tool.ts → Sanity mutations
```

### Data Flow (RAG pipeline)
1. User sends message to `POST /api/chat`
2. `route.ts` creates ObservabilityService, calls `orchestrator()`
3. `orchestrator` calls `classifyIntent()` (regex fast-path → LLM classification)
4. If intent is `"portfolio"`: `searchPortfolio()` executes two-tier retrieval
5. Tier 1: 8 regex patterns matching against Sanity GROQ queries (structured data)
6. Tier 2: Qdrant vector similarity search (k=5, cosine, 768d embeddings)
7. Results pass through `buildEvidencePackage()` (dedup, format, truncate to 2000 chars)
8. `runLLMPipeline()` streams LLM tokens via SSE to the client
9. Observability events recorded: intent classification generation, retrieval span, evidence span, chat generation

### External Systems
- **Sanity CMS**: Content Lake (read/write via GROQ queries)
- **Qdrant**: Vector database (Docker, port 6333, collection `portfolio_chunks`)
- **vLLM**: LLM inference server (Docker, port 8000) - intended but non-functional
- **Ollama**: Alternative LLM provider (port 11434) - actually working
- **MLflow**: Experiment tracking (Docker, port 5000)
- **Langfuse**: LLM observability (SaaS or self-hosted)

---

## 4. Major Engineering Components

### 4.1 Orchestrator (`lib/agent/orchestrator.ts`)
- **Responsibility**: Main pipeline coordinator. AsyncGenerator that sequences intent classification → retrieval → evidence building → LLM generation.
- **Important files**: `lib/agent/orchestrator.ts:16-108`, `app/api/chat/route.ts:5-70`
- **Interactions**: Calls `classifyIntent()` from intent-router, `searchPortfolio()` from retrieval, `buildEvidencePackage()`, and `runLLMPipeline()`.
- **Design reasoning**: Thin coordination layer with no business logic. Streams SSE events via `AsyncGenerator`. Handles early exits for guardrail intents (greeting/out_of_scope/ambiguous) without touching retrieval. Observability span ownership is distributed across components (orchestrator owns retrieval + evidence spans). Known bug: `tracer` variable (LangfuseTracer) imported at line 14 but never instantiated, causing ReferenceError on all requests.

### 4.2 Intent Router (`lib/agent/intent-router.ts`)
- **Responsibility**: Classify user messages into 4 intents: `portfolio`, `greeting`, `out_of_scope`, `ambiguous`.
- **Important files**: `lib/agent/intent-router.ts:37-90`
- **Interactions**: Uses `ChatOpenAI` (via `getIntentModel()`) for LLM classification. Regex fast-path for greetings bypasses LLM entirely.
- **Design reasoning**: Two-layer classification with regex fast-path (~1ms) then LLM (~50-200ms). LLM is lightweight (qwen2.5:1.5b). `ambiguous` is a distinct intent, not a fallback to `portfolio`. Parser uses substring matching (`raw.includes(i)`) not exact match, so semantic return values like "experience" would silently default to `ambiguous`.

### 4.3 Retrieval Layer (`lib/retrieval/`)
- **Responsibility**: Two-tier retrieval: structured patterns (regex → Sanity GROQ queries) then semantic fallback (Qdrant vector search).
- **Important files**: `lib/retrieval/index.ts:86-98`, `lib/retrieval/semantic.ts:4-25`, `lib/retrieval/structured.ts`
- **Interactions**: `searchPortfolio()` evaluates 8 patterns in order, returns first non-empty handler. Falls to `searchSemantic()` which calls Qdrant via LangChain.
- **Design reasoning**: Structured patterns handle common query types (skills, experience, contact, technology lookup) deterministically without LLM. Semantic search provides flexibility for novel queries. Known gap: pattern 5 matches `experience|work history|employment` but not company names like "Neilsoft" - company-specific queries fall through to semantic search and fail to rank experience chunks in top-5 (`RAG_Debug_Report.md`).

### 4.4 Evidence Builder (`lib/agent/evidence-builder.ts`)
- **Responsibility**: Transform raw `SearchResult[]` into formatted context block and deduplicated source list.
- **Important files**: `lib/agent/evidence-builder.ts:28-43`
- **Interactions**: Receives results from `searchPortfolio()`, passes formatted context + sources to `llm-pipeline.ts`.
- **Design reasoning**: Deduplicates by first 100 characters, formats as structured text with project/section labels, truncates to `MAX_CONTEXT_CHARS = 2000`. Pure function, no side effects. Context is injected as a separate system message (not in the system prompt) to keep the prompt cacheable.

### 4.5 LLM Pipeline (`lib/agent/llm-pipeline.ts`)
- **Responsibility**: Single streaming LLM call with pre-loaded evidence context.
- **Important files**: `lib/agent/llm-pipeline.ts:29-112`
- **Interactions**: Builds message array (system prompt + evidence context + conversation history), streams from `ChatOpenAI.stream()`, extracts UI actions (`[openResume]`, `[openProject:slug]`, `[scrollTo:section]`) from response text.
- **Design reasoning**: Replaced LangGraph agent (which had 2-3 LLM calls per ReAct loop) with a single direct LLM call. Intent is: "given evidence, answer the question" — no search autonomy needed. Token counts extracted from usage_metadata on the final stream chunk. Temperature is always 0.

### 4.6 AI Provider Layer (`lib/ai/`)
- **Responsibility**: Factory functions for LLM, embedding, and vector store instances.
- **Important files**: `lib/ai/provider.ts:12-26`, `lib/ai/embeddings.ts:3-24`, `lib/ai/vector-store.ts:6-22`
- **Interactions**: Called by all pipeline components for model access.
- **Design reasoning**: Abstraction allows swapping providers (Ollama, vLLM, OpenAI-compatible). URL resolution chain: `VLLM_BASE_URL` → `CHAT_BASE_URL` + `/v1` → `localhost:8000/v1`. Embeddings support `ollama` or `openai` providers via `EMBEDDING_PROVIDER` env var. `HuggingFace` embeddings were explicitly deprecated in code. Known bug: default embedding provider was `huggingface` but `@huggingface/transformers` is not installed in `package.json`, causing `embedQuery()` to throw `ERR_MODULE_NOT_FOUND` (`Semantic_Search_Investigation.md`).

### 4.7 Observability Layer (`lib/observability/`)
- **Responsibility**: Provider-agnostic observability abstraction for tracing LLM requests.
- **Important files**: `lib/observability/service.ts:6-23`, `lib/observability/langfuse.ts:89-177`, `lib/observability/types.ts:21-33`
- **Interactions**: `route.ts` creates service, passes `ObservabilityContext` through pipeline. Each component creates spans/generations via the abstraction.
- **Design reasoning**: Interface-based abstraction (`ObservabilityService` interface) so pipeline code never imports Langfuse directly. Langfuse is fully confined to `lib/observability/langfuse.ts`. Two implementations: `LangfuseObservabilityService` and `NoopObservabilityService`. Flush with 2s timeout prevents Langfuse from hanging the response. Module-level Langfuse client singleton is reused across requests.

### 4.8 Ingestion Pipeline (`scripts/index-content.ts`)
- **Responsibility**: Index Sanity content into Qdrant vector database.
- **Important files**: `scripts/index-content.ts:335-411`
- **Interactions**: Fetches from Sanity (or fallback content), chunks documents by type (project/site-settings/experience/skill-category/technical-note), embeds via `getEmbeddings()`, inserts into Qdrant via `QdrantVectorStore.fromDocuments()`.
- **Design reasoning**: Deterministic section-based chunking (no LangChain text splitters). Experience entries get a single monolithic chunk per entry. Known bug: `fromDocuments()` does NOT clear the collection before re-indexing (`RAG_Stale_Vector_DB_Investigation.md` line 365-428). Running the script multiple times accumulates duplicate vectors. No `npm run index-content` script in `package.json` even though `README.md` references it.

### 4.9 TypeScript Bridge Scripts (`scripts/`)
- **Responsibility**: Thin CLI bridges between the Python publishing agent and Sanity mutations.
- **Important files**: 13 scripts (`create-project.ts`, `update-project.ts`, `sync-dataset.ts`, `describe-schema.ts`, etc.)
- **Interactions**: Called by Python agent via shell. Delegate to `scripts/publish-tool.ts` for Sanity mutations. Load `.env.local` via `scripts/load-env.ts`.

### 4.10 Frontend Components (`components/`)
- **Responsibility**: React components for the portfolio website, including the chat UI.
- **Important files**: `components/Chat/` (8 files: `ChatProvider.tsx`, `ChatMessage.tsx`, `SlideOutPanel.tsx`, etc.)
- **Interactions**: `ChatProvider.tsx` consumes SSE stream from `/api/chat` and renders tokens progressively. Slide-out panel shows evidence sources and citations.

---

## 5. Technologies Used

### Frontend
| Technology | Role | Where it appears | Why chosen |
|------------|------|-----------------|------------|
| Next.js 15 | Web framework (App Router) | Root config, `app/` directory, `next.config.ts` | SSG/ISR for portfolio pages; Route Handlers for API |
| React 19 | UI library | `components/`, `app/` pages | Required by Next.js |
| TypeScript 5.8 | Type safety | All `.ts`/`.tsx` files | N/A (standard for the ecosystem) |
| Tailwind CSS 4 | Styling | `postcss.config.mjs`, `app/globals.css` | Utility-first CSS |
| Sanity CMS 3.88 | Headless CMS | `sanity/` directory, `sanity.cli.ts`, `sanity.config.ts` | Structured content with GROQ queries |
| next-sanity | Sanity + Next.js integration | `sanity/client.ts`, `sanity/queries.ts` | Official Sanity Next.js SDK |
| @portabletext/react | Portable Text rendering | `components/PortableContent.tsx` | Renders Sanity's rich text format |
| sanity-plugin-markdown | Markdown schema type | `sanity/schemaTypes/`, `package.json:37` | Supports markdown fields in Sanity documents |
| fumadocs-core / fumadocs-ui | Documentation page navigation | `lib/project-docs-source.ts` | Generates nested navigation tree for project doc pages |
| lucide-react | Icons | Components throughout | N/A |
| mermaid | Diagram rendering | Components | Display architecture diagrams in markdown |
| react-markdown | Markdown rendering | `components/Markdown.tsx` | Render markdown content from Sanity |
| @vercel/analytics | Web analytics | `app/layout.tsx` | Vercel platform analytics |

### Backend / AI
| Technology | Role | Where it appears | Why chosen |
|------------|------|-----------------|------------|
| LangChain (core, openai, ollama, qdrant) | LLM orchestration framework | `lib/ai/`, `lib/retrieval/`, `scripts/index-content.ts` | Provides LLM client abstraction, streaming, embedding integration |
| Qdrant | Vector database | `docker-compose.yml:17-24`, `lib/ai/vector-store.ts`, `scripts/index-content.ts` | Dense vector similarity search; Docker deployment |
| Langfuse | LLM observability | `lib/observability/langfuse.ts`, `lib/agent/langfuse-tracer.ts` | Trace/spans/generations for LLM debugging |
| MLflow | Experiment tracking | `docker-compose.yml:26-43`, `lib/agent/mlflow-logger.ts` | Log metrics, params, and run metadata |
| Ollama | Local LLM runtime | `.env.local` configuration, `lib/ai/embeddings.ts` (fallback) | Local inference without GPU requirements |
| vLLM | GPU LLM inference | `docker-compose.yml:2-15`, `lib/ai/provider.ts` | Intended primary LLM provider (non-functional: no GPU) |
| Qdrant Client | Qdrant REST API client | `lib/ai/vector-store.ts` | Direct Qdrant operations |
| Zod | Schema validation | `package.json:40` | TypeScript-first schema validation |
| uuid | Unique ID generation | `lib/agent/langfuse-tracer.ts` | Trace/span ID generation |
| @langchain/core | Document model, base classes | `scripts/index-content.ts` | `Document` type for chunking |

### Infrastructure
| Technology | Role | Where it appears | Why chosen |
|------------|------|-----------------|------------|
| Docker Compose | Infrastructure orchestration | `docker-compose.yml` | Runs Qdrant, vLLM, MLflow as local services |
| ESLint 9 | Linting | `eslint.config.mjs` | Code quality |
| npx tsx | TypeScript execution | `package.json`, `scripts/` | Execute TS scripts without compilation step |

---

## 6. Architecture Decisions

### Decision 1: Retrieval-first architecture (not agent-first)
- **Evidence**: `docs/architecture/streaming-refactor-plan.md` lines 32-66, 646-663
- **Rationale**: The LangGraph ReAct agent was removed because mandatory pre-retrieval eliminates the need for a ReAct loop. No search autonomy is needed. A single direct LLM call with pre-loaded evidence is simpler, faster, and more debuggable.
- **Tradeoffs**: LLM cannot search for follow-up information not in the initial evidence. Conversation history (last 10 messages) must carry context.
- **Alternatives mentioned**: Revision 2 of the plan kept a bounded LangGraph agent with reasoning autonomy but no search autonomy. Revision 3 removed it entirely.

### Decision 2: Mandatory pre-retrieval (structured patterns → semantic fallback)
- **Evidence**: `lib/retrieval/index.ts:86-98`, `AGENTS.md` lines 72-78
- **Rationale**: Structured patterns handle common query types deterministically (skills, experience, contact). Semantic search provides flexibility. The `searchPortfolio()` function evaluates patterns in order and returns the first non-empty result.
- **Tradeoffs**: Pattern matching is brittle — company name queries fail because the experience pattern only matches generic keywords (`experience|work history|employment`), not company names. Semantic search with k=5 is insufficient for 57 chunks.
- **Alternatives**: None documented.

### Decision 3: Two-layer intent classification (regex fast-path + LLM)
- **Evidence**: `lib/agent/intent-router.ts:25-47`, `streaming-refactor-plan.md` lines 112-155
- **Rationale**: Greeting patterns are matched by regex (~1ms) to avoid unnecessary LLM calls. Non-greeting queries use a lightweight LLM (`qwen2.5:1.5b`). Fallback for unrecognized queries is `ambiguous`, not `portfolio`.
- **Tradeoffs**: LLM classification adds 50-200ms latency. Substring matching in parser (`raw.includes(i)`) means semantically correct but schema-invalid labels (e.g., "experience") silently default to `ambiguous`.

### Decision 4: Observability via abstracted interface (not Langfuse SDK directly)
- **Evidence**: `lib/observability/types.ts:21-33`, `docs/architecture/orchestration-layer.md` lines 35-56
- **Rationale**: Pipeline code imports `ObservabilityService` interface only — never Langfuse types. Langfuse is fully confined to `lib/observability/langfuse.ts`. This makes Langfuse swappable and prevents provider-specific leaks.
- **Tradeoffs**: Manual tracing only (no LangChain callback handler). Manual tracing gives full control over span/generation contents but requires explicit instrumentation at every pipeline stage.

### Decision 5: No LangChain callback handler (manual tracing only)
- **Evidence**: `docs/architecture/orchestration-layer.md` line 103: "No LangChain callback handler or `getLangChainCallbacks()` method"
- **Rationale**: Langfuse LangChain handler is incompatible with manual trace approach in v5. Manual tracing gives full control over span/generation contents.
- **Tradeoffs**: Requires explicit `startSpan()` / `end()` calls at every pipeline stage. Token counts must be manually extracted from `usage_metadata`.

### Decision 6: Deterministic spec-parsing for project creation (no LLM generation)
- **Evidence**: `AGENTS.md` lines 121-135: "Happy path is fully deterministic... LLM is only a self-repair fallback"
- **Rationale**: The publishing agent copies spec content verbatim into matching Sanity fields. It does not rewrite, summarize, or invent content. LLM is a fallback only when deterministic validation fails.
- **Tradeoffs**: Spec format is rigid (labeled bullets). Cannot handle free-form natural language project descriptions.

### Decision 7: Section-based deterministic chunking (no LangChain text splitters)
- **Evidence**: `scripts/index-content.ts:117-300`, `RAG_Stale_Vector_DB_Investigation.md` lines 127-134
- **Rationale**: Custom chunking functions per document type produce clean, predictable chunks at known section boundaries. No LangChain `RecursiveCharacterTextSplitter` or other splitters are used.
- **Tradeoffs**: Experience entries produce single monolithic chunks where company names are diluted (<1% of chunk content). No chunk synergy/overlap.

### Decision 8: `QdrantVectorStore.fromDocuments()` without collection clearing
- **Evidence**: `RAG_Stale_Vector_DB_Investigation.md` lines 363-427
- **Rationale**: The LangChain `fromDocuments()` static factory calls `ensureCollection()` (creates only if absent) then `addVectors()` (inserts with new UUIDs). Old points are never deleted.
- **Tradeoffs**: Running the ingestion script multiple times accumulates duplicate vectors. No versioning/timestamp metadata to identify stale vectors. Noted as a confirmed accumulation bug.

### Decision 9: Flush timeout of 2 seconds for Langfuse
- **Evidence**: `lib/observability/langfuse.ts:165-176`, `docs/architecture/orchestration-layer.md` lines 518-534
- **Rationale**: Prevents Langfuse from hanging the response. `Promise.race` between `flushAsync()` and a 2-second timeout.
- **Tradeoffs**: Traces may be lost if flush takes longer than 2s. Response is unaffected.

### Decision 10: `ObservabilityContext` as explicit parameter (not AsyncLocalStorage)
- **Evidence**: `docs/architecture/orchestration-layer.md` lines 543-544
- **Rationale**: Explicit parameter passing rather than AsyncLocalStorage context propagation. Noted as potential future improvement.
- **Tradeoffs**: Every pipeline function must accept and pass the context parameter. Increased diff surface area when adding observability to new components.

---

## 7. Engineering Challenges

### Challenge 1: `tracer` Undefined ReferenceError in Orchestrator
- **Problem**: `lib/agent/orchestrator.ts:14` imports `LangfuseTracer` but never instantiates it. Six call sites reference `tracer` which throws `ReferenceError` at runtime.
- **Approach**: Discovered during runtime trace investigation (`Runtime_Request_Trace_Investigation.md`). The `tracer` bug causes every request to crash, sending a success message (from guardrail) followed by an error SSE event.
- **Outcome**: Fixed in `Runtime_Fix_Report.md` by instantiating `const tracer = new LangfuseTracer()` at module scope and adding start/end lifecycle calls.

### Challenge 2: Missing `@huggingface/transformers` Dependency
- **Problem**: `lib/ai/embeddings.ts` creates `HuggingFaceTransformersEmbeddings` which dynamically imports `@huggingface/transformers`. This package is not listed in `package.json` and not present in `node_modules`. Every call to `embedQuery()` throws `ERR_MODULE_NOT_FOUND`.
- **Approach**: Discovered during semantic search investigation (`Semantic_Search_Investigation.md`). The error is silently caught by `searchSemantic()`'s try/catch, which returns empty results. The user sees "I couldn't find that information" without any indication of the underlying failure.
- **Outcome**: Semantic search has never successfully executed. Any query falling through to semantic search silently returns empty results.

### Challenge 3: vLLM Cannot Start (No GPU on Host)
- **Problem**: `docker-compose.yml:2-15` configures vLLM with `--gpu-memory-utilization 0.90`, requiring a GPU. The host has no GPU, so vLLM crashes on startup with `RuntimeError: Failed to infer device type` (`Runtime_Request_Trace_Investigation.md` Appendix B).
- **Approach**: Container crash-loops with 130+ iterations. Docker proxy accepts TCP at kernel level but immediately resets the connection.
- **Outcome**: The environment was reconfigured to use Ollama (port 11434) via the `resolveBaseUrl()` fix. vLLM remains non-functional.

### Challenge 4: pRetry Hangs for ~17 Minutes
- **Problem**: `lib/ai/provider.ts` created `ChatOpenAI` without `timeout` or `maxRetries`. The `@langchain/core` pRetry function uses defaults: `retries=10`, `minTimeout=1000ms`, `factor=2`. With exponential backoff (1s+2s+...+512s), the theoretical maximum is ~1023 seconds (~17 minutes).
- **Approach**: Fixed in `Runtime_Fix_Report.md` by adding `timeout: 180000`, `maxRetries: 1`, `maxTokens: 4096`. The `maxRetries` parameter maps to pRetry retries, reducing from 10 to 1.
- **Outcome**: LLM call failures now time out in 3 minutes instead of 17 minutes.

### Challenge 5: Structured Pattern Matching Gap for Company Names
- **Problem**: `lib/retrieval/index.ts` pattern 5 matches `experience|work history|employment|previous role|past role|career` but not company names. Queries like "What did you do at Neilsoft?" fall through to semantic search, where the query doesn't contain experience keywords.
- **Approach**: Diagnosed in `RAG_Debug_Report.md`. Eight patterns evaluated against queries like "What did you do at Neilsoft?" — all fail because the query doesn't start with "explain/tell me about" and doesn't contain "experience/work history" keywords.
- **Outcome**: Queries about specific companies fail silently. The RAG Debug Report recommends adding a company-name-matching pattern or expanding the experience pattern.

### Challenge 6: Semantic Search k=5 Too Small
- **Problem**: `lib/retrieval/semantic.ts:4` hardcodes `k = 5`. With ~57 total chunks, experience chunks are frequently pushed out of the top-5 by site settings, project chunks, and skill categories that share ML/AI terminology.
- **Approach**: Vector neighborhood analysis (`Semantic_Search_Investigation.md`) showed Neilsoft experience chunk ranks 6+ in its own semantic neighborhood. Site settings (Bio, About, Hero) outrank experience chunks.
- **Outcome**: Even with a functional embedding model, experience-specific queries would fail for company names because the proper noun signal is diluted among shared ML/AI terminology.

### Challenge 7: Qdrant Vector Accumulation on Re-index
- **Problem**: `QdrantVectorStore.fromDocuments()` calls `ensureCollection()` (creates if absent) then `addVectors()` (inserts with new UUIDs). Old points are never deleted.
- **Approach**: Confirmed in `RAG_Stale_Vector_DB_Investigation.md` lines 363-427 by inspecting `@langchain/qdrant` source code. Running `npx tsx scripts/index-content.ts` twice produces 52 vectors (26 old + 26 new), three times produces 78 vectors.
- **Outcome**: No accumulation has occurred (current database has 26 clean vectors), but the risk is documented. Recommended to delete the Qdrant collection before re-indexing.

### Challenge 8: Experience Chunks Are Monolithic
- **Problem**: `scripts/index-content.ts:228-252` (`chunkExperience()`) produces a single monolithic chunk per experience entry (role + company + description + bullets + skills). Company name "Neilsoft" appears once in ~85 words (<1% of chunk content). The embedding model weights heavily toward ML/AI terminology, not the proper noun.
- **Approach**: No splitting or restructuring applied. Each experience entry = 1 vector in Qdrant.
- **Outcome**: Experience chunks have poor retrieval characteristics for company-name queries.

### Challenge 9: Intent Classification Latency (Thinking Mode)
- **Problem**: The `qwen3:4b` model has a thinking/reasoning phase that makes intent classification very slow. Measured times: 11-65 seconds per classification call.
- **Approach**: Noted in `Runtime_Fix_Report.md` remaining known issues. The intent model takes 65 seconds for a "Tell me about Video Captioning Agent" query.
- **Outcome**: Intent classification is the bottleneck in the pipeline, consuming most of the end-to-end latency.

---

## 8. Debugging & Iteration Evidence

### Investigation Reports (5 documents)
The repository contains 5 detailed forensic investigation reports, each 400-700 lines:
1. **RAG_Debug_Report.md** (696 lines): Root cause analysis of experience information retrieval failure. Maps all 8 structured patterns against specific queries, identifies pattern matching gap.
2. **RAG_Stale_Vector_DB_Investigation.md** (567 lines): Determines Qdrant database is not stale but was populated from live Sanity content. Identifies vector accumulation bug in `fromDocuments()`.
3. **Runtime_Request_Trace_Investigation.md** (454 lines): Runtime instrumentation of "What did I do at the company Neilsoft?" query. Documents 3-blocking-failure chain. Confirms vLLM crash, pRetry hang, and undefined tracer bug.
4. **Intent_Router_Investigation.md** (559 lines): Forensics on why intent classification returns `"ambiguous"` for portfolio queries. Confirms LLM unreachable + tracer undefined.
5. **Semantic_Search_Investigation.md** (533 lines): Forensics on semantic search failure. Identifies missing `@huggingface/transformers` dependency and Neilsoft chunk ranking below top-5.
6. **Sanity_Dataset_Indexing_Investigation.md** (522 lines): Determines production and local Sanity datasets are byte-for-byte identical and match Qdrant. Falsifies "wrong dataset" hypothesis.

### Architecture Refactor Plans
1. **docs/architecture/streaming-refactor-plan copy.md** (613 lines, Revision 2): Plans bounded LangGraph agent with mandatory pre-retrieval. Application owns policy, agent owns reasoning.
2. **docs/architecture/streaming-refactor-plan.md** (663 lines, Revision 3): Removes LangGraph entirely. Replaces ReAct agent with direct `ChatOllama.stream()` call. Details file-by-file impact analysis, migration strategy, risk analysis, validation strategy.

### Fix Commits (from Runtime_Fix_Report.md and git log)
- Commit `05a9007`: `fix(intent-router): Fixed bug in intent router` — Migrated from `ChatOllama` to `getIntentModel()`, changed return type from `ClassifierResult` to `Intent`, simplified text extraction.
- Commit `6877320`: `refactor(observability): introduce provider-agnostic observability service` — Introduced `ObservabilityService` interface. (Note: tracer undefined bug likely originated here.)
- Commit `73bae30`: `feat(observability): add Langfuse tracing and enhance MLflow logging` — Added `LangfuseTracer` and `MLflowLogger` imports.
- Commit `dced397`: `refactor(agent): replace LangGraph with direct LLM pipeline` — Removed LangGraph agent (graph.ts, tools.ts, types.ts deleted).

### Runtime Fix Report (`Runtime_Fix_Report.md`, 195 lines)
Documents 5 runtime fixes in a single session:
1. Instantiated missing `tracer` in orchestrator
2. Added timeout/maxRetries/maxTokens to ChatOpenAI
3. Added `resolveBaseUrl()` to support `CHAT_BASE_URL` env var fallback
4. Added `EMBEDDING_PROVIDER` switch for Ollama embeddings
5. Added structured console.error in intent-router catch block

---

## 9. Measurable Outcomes

### Latency Measurements (from Runtime_Fix_Report.md)
| Metric | Before Fix | After Fix | Source |
|--------|-----------|-----------|--------|
| Non-portfolio TTFT (greeting) | ~17 min (pRetry hang) | ~0ms (regex fast path) | `Runtime_Fix_Report.md` line 145 |
| Intent classification (non-greeting) | ~17 min → crash | 11-65 seconds | `Runtime_Fix_Report.md` line 172-173 |
| Portfolio TTFT | ~17 min → crash | ~1600-2700ms (target) | `streaming-refactor-plan.md` lines 626-627 |
| pRetry hang time | ~1023 seconds | 180000ms (3 min) + 1 retry | `Runtime_Request_Trace_Investigation.md` line 345 |

### Vector Database Metrics
| Metric | Value | Source |
|--------|-------|--------|
| Qdrant points | 26 | `RAG_Stale_Vector_DB_Investigation.md` line 225 |
| Qdrant indexed vectors | 0 (on-disk) | Same, line 229 |
| Vector dimensions | 768 | Same, line 227 |
| Distance metric | Cosine | Same, line 228 |
| Estimated total chunks in Sanity | ~57 | `RAG_Debug_Report.md` lines 196-207 |

### Code Quality
| Metric | Result | Source |
|--------|--------|--------|
| TypeScript typecheck | PASSED | `Runtime_Fix_Report.md` line 161 |
| ESLint | 0 errors, 3 warnings | Same, line 165 |

### Chunk Distribution
| Section | Count | Types |
|---------|-------|-------|
| Short Summary | 3 | 2 projects + 1 technical note |
| Problem Statement | 2 | 2 projects |
| Approach | 2 | 2 projects |
| Results | 1 | 1 project |
| Limitations | 2 | 2 projects |
| Future Improvements | 2 | 2 projects |
| Technologies | 2 | 2 projects |
| Key Metrics | 1 | 1 project |
| Experience | 3 | 3 experience entries |
| Skills | 4 | 4 skill categories |
| About/Bio/Hero/Contact/Tags | 5 | Site settings + notes |

### Token Counts
| Model | Configuration | Evidence |
|-------|--------------|----------|
| Chat model (default) | `Qwen/Qwen3-4B-Instruct`, temp=0, maxTokens=4096 | `lib/ai/provider.ts:15` |
| Intent model (default) | `qwen2.5:1.5b`, temp=0 | `lib/agent/intent-router.ts:56` |
| Embedding model (default) | `Xenova/nomic-embed-text-v1.5`, 768d | `lib/ai/embeddings.ts:6` |
| Evidence context limit | 2000 characters | `lib/agent/evidence-builder.ts:4` |
| Conversation history | Last 10 messages | `lib/agent/llm-pipeline.ts:42` |

---

## 10. Ownership Signals

### Custom Abstraction: ObservabilityService Interface
- **Evidence**: `lib/observability/types.ts:21-33`, `lib/observability/langfuse.ts:89-177`, `lib/observability/noop.ts:13-24`
- **Description**: Full provider-agnostic observability layer with interface, config, factory, Langfuse implementation, and no-op implementation. Pipeline code never imports Langfuse directly. Span and generation handles auto-compute duration from creation time. Flush timeout protection (2s).
- **Location**: `lib/observability/` (6 files, 700+ lines)

### Custom Abstraction: MLflow Logger
- **Evidence**: `lib/agent/mlflow-logger.ts:14-260`
- **Description**: Thin wrapper over MLflow Tracking REST API. Stages metrics in memory, flushes batch on `endRun()`. Auto-creates experiments if they don't exist (handles 404/400/409 race conditions). Implements exponential backoff retry for resource-already-exists errors.
- **Location**: `lib/agent/mlflow-logger.ts`

### Custom Abstraction: Two-Tier Retrieval Router
- **Evidence**: `lib/retrieval/index.ts:7-98`
- **Description**: 8 structured patterns with regex matching routing to Sanity GROQ query handlers, with semantic fallback. Patterns evaluated in order, first non-empty wins.
- **Location**: `lib/retrieval/index.ts`

### Custom Abstraction: Evidence Package Builder
- **Evidence**: `lib/agent/evidence-builder.ts:28-43`
- **Description**: Deduplication by first 100 characters, structured formatting with source metadata, truncation at 2000 characters.
- **Location**: `lib/agent/evidence-builder.ts`

### Custom Abstraction: LangfuseTracer
- **Evidence**: `lib/agent/langfuse-tracer.ts:39-163`
- **Description**: Dedicated tracer class with manual start/end lifecycle for traces, spans, and generations. Graceful degradation when Langfuse is unconfigured.
- **Location**: `lib/agent/langfuse-tracer.ts`

### Architecture Refactor Documents
- **Evidence**: `docs/architecture/streaming-refactor-plan.md` (Revision 3), `docs/architecture/streaming-refactor-plan copy.md` (Revision 2), `docs/architecture/orchestration-layer.md`
- **Description**: Three detailed architectural plans documenting the evolution from LangGraph ReAct agent → bounded LangGraph agent → direct LLM pipeline. Each plan includes migration strategy, risk analysis, validation strategy, and file-by-file impact analysis.

### Forensic Investigation Reports
- **Evidence**: 6 markdown reports (RAG_Debug_Report, RAG_Stale_Vector_DB_Investigation, Runtime_Request_Trace_Investigation, Intent_Router_Investigation, Semantic_Search_Investigation, Sanity_Dataset_Indexing_Investigation)
- **Description**: Each report is 400-700 lines with Mermaid diagrams, source-code citations, execution tables, confidence assessments, and root cause matrices.

### Custom Chunking Implementation
- **Evidence**: `scripts/index-content.ts:117-300`
- **Description**: Five deterministic section-based chunking functions per document type (project, site settings, experience, skill category, technical note). No LangChain splitters. Each function produces Documents with metadata.

### Automated Shell-Based Workflow Tools
- **Evidence**: 13 scripts in `scripts/` directory
- **Description**: Thin TypeScript bridge scripts for full CRUD lifecycle on Sanity CMS (create, read, update, delete, publish, unpublish, sync datasets, describe schema). Called by Python agent via shell.

### Agent Design Guidelines
- **Evidence**: `AGENTS.md` (212 lines)
- **Description**: Comprehensive documentation covering dev commands, architecture, schema requirements, workflow tools, determinism stance, dataset synchronization, environment policy, and Langfuse observability.

---

## 11. Candidate Knowledge Evidence Summary

### Experiences Demonstrated

**Full-stack AI application development**:
- Built Next.js 15 portfolio website with App Router, ISR, and Sanity CMS integration
- Implemented a RAG-based chat assistant with streaming SSE responses
- Created a Python publishing agent with tool-calling and deterministic spec-parsing
- Wrote 13 TypeScript CLI bridge scripts for Sanity CRUD operations

**Retrieval-Augmented Generation (RAG) engineering**:
- Designed two-tier retrieval with structured patterns (GROQ queries) and semantic search (Qdrant)
- Implemented evidence building with deduplication, formatting, and context truncation
- Built custom intent classification with regex fast-path and LLM backing
- Conducted forensic analysis showing Neilsoft chunk ranks below top-5 due to proper noun dilution

**Observability and experiment tracking**:
- Designed provider-agnostic `ObservabilityService` interface
- Implemented Langfuse trace/span/generation tracking with auto-duration and token capture
- Implemented MLflow REST API wrapper with batch logging and experiment auto-creation
- Wrote detailed architecture document showing trace lifecycle and sequence diagram

**Debugging and systems investigation**:
- Produced 6 forensic investigation reports (total ~3,400 lines)
- Diagnosed and fixed 5 blocking runtime issues in one session
- Traced a 3-bug failure chain: vLLM crash → pRetry 17min hang → undefined tracer ReferenceError
- Discovered `@huggingface/transformers` missing dependency blocking all semantic search
- Identified Qdrant vector accumulation bug in `fromDocuments()`

**Architecture design and refactoring**:
- Planned removal of LangGraph ReAct agent in favor of direct LLM pipeline
- Documented 3 architecture revisions with migration strategies, risk matrices, and validation plans
- Shifted policy from LLM to application layer (intent routing, mandatory retrieval)

### Technologies Used
Next.js 15, React 19, TypeScript 5.8, Sanity CMS 3.88, Qdrant, LangChain (core/openai/ollama/qdrant), Langfuse, MLflow, Ollama, vLLM, Docker Compose, Tailwind CSS 4, Zod, GROQ, Server-Sent Events, OpenAI-compatible API protocol

### Architecture Decisions Made
- Retrieval-first over agent-first (mandatory pre-retrieval, no ReAct loop)
- Two-tier retrieval: structured patterns → semantic fallback
- Two-layer intent classification: regex fast-path → LLM
- Provider-agnostic observability (interface-based, Langfuse fully confined)
- Manual tracing only (no LangChain callback handler)
- Deterministic section-based chunking (no LangChain splitters)
- Evidence builder with 2000-char truncation budget
- Flush timeout of 2s for Langfuse (prevents response hanging)
- Observable context as explicit parameter (not AsyncLocalStorage)
- `QdrantVectorStore.fromDocuments()` without collection clearing (accumulation risk noted)

### Measurable Outcomes
- Greeting TTFT: ~0ms after fix (was ~17 min)
- Intent classification latency: 11-65 seconds (thinking mode bottleneck)
- Qdrant database: 26 vectors, 768d cosine, 0 indexed vectors (on-disk)
- Total estimated content: ~57 chunks (3 experience, 4 skill categories, 2 projects, site settings, 1 technical note)
- TypeScript: typecheck passed, ESLint 0 errors 3 warnings
- pRetry timeout reduced from ~1023s to 180s (timeout) + 1 retry

### Ownership Evidence
- Custom `ObservabilityService` interface + 2 implementations (Langfuse + Noop)
- Custom `MLflowLogger` with REST API wrapper, batch flushing, experiment auto-creation
- Custom `LangfuseTracer` class with manual trace/span/generation management
- Custom two-tier retrieval router with 8 structured patterns
- Custom evidence package builder with dedup, format, truncate
- Custom chunking functions (5 per document type)
- 13 CLI bridge scripts for full Sanity CRUD lifecycle
- 3 architecture refactor documents with migration strategies and risk analysis
- 6 forensic investigation reports with root cause matrices
- `AGENTS.md` documenting full system architecture, workflow tools, and design stance

### Debugging Evidence
- 6 investigation reports: RAG Debug, Stale Vector DB, Runtime Request Trace, Intent Router, Semantic Search, Sanity Dataset Indexing
- 5 runtime fixes deployed simultaneously (tracer instantiation, provider timeout, URL resolution, embedding provider switch, error logging)
- Chained failure analysis: vLLM crash → pRetry → undefined tracer → retrieval never reached
- Dependency audit: identified `@huggingface/transformers` missing from `package.json`
- Chunk ranking analysis: Neilsoft ranked 6+ in its own semantic neighborhood
- Dataset comparison: production ≡ local ≡ Qdrant (all identical)
