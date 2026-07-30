# Portfolio Chat Assistant — Subsystem Analysis

## 1. Project Overview

**Subsystem name**: Portfolio Chat Assistant (RAG Chatbot)

**One-paragraph summary**: A retrieval-augmented generation (RAG) chatbot that answers natural-language questions about a software engineer's portfolio. Users ask questions like "Which projects use Python?" or "Tell me about the video captioning agent" and receive evidence-backed answers streamed via Server-Sent Events. The system uses a two-tier retrieval architecture (structured GROQ patterns → Qdrant semantic search) and streams LLM tokens directly to the browser without a ReAct agent loop.

**Primary objective**: Provide grounded, evidence-backed Q&A over portfolio data without hallucination.

**Target users**: Recruiters, collaborators, and visitors to the portfolio website.

**Current maturity**: MVP/Prototype. Multiple known blocking bugs: undefined `tracer` variable (`lib/agent/orchestrator.ts:14`), missing `@huggingface/transformers` dependency (`Semantic_Search_Investigation.md`), and LLM unreachable on no-GPU host (`Runtime_Request_Trace_Investigation.md`). Semantic search has never successfully executed.

---

## 2. Problem Being Solved

**Why this project exists**: Portfolio visitors want to ask natural-language questions about a person's projects, skills, and experience without reading through pages of content. A chat interface with RAG allows visitors to ask specific questions and receive concise, evidence-backed answers.

**Engineering constraints identified**:
- Local LLM only (Ollama / vLLM); no cloud API calls. Evidence: `lib/ai/provider.ts:9` defaults to `localhost:8000/v1` with `apiKey: "EMPTY"`.
- All infrastructure via Docker Compose (Qdrant for vectors, vLLM/Ollama for LLM). Evidence: `docker-compose.yml`.
- Sanity CMS as single source of truth (no custom backend). Evidence: `AGENTS.md` line 19.
- System must degrade gracefully when unconfigured. Evidence: `lib/observability/service.ts:22` returns `NoopObservabilityService` if Langfuse keys missing.

---

## 3. High-Level Architecture

```
User → POST /api/chat → route.ts → orchestrator.ts
                                         │
                                    classifyIntent()
                                         │
                           ┌─────────────┴──────────┐
                           │  portfolio intent       │ greeting/out_of_scope/ambiguous
                           ▼                         ▼
                      searchPortfolio()          Guardrail response (hardcoded string)
                           │
                    ┌──────┴──────┐
                    │ Tier 1      │ 8 structured regex patterns → Sanity GROQ
                    │ Tier 2      │ Qdrant semantic search (k=5, cosine, 768d)
                    └──────┬──────┘
                           ▼
                    buildEvidencePackage()
                    (dedup, format, truncate to 2000 chars)
                           │
                           ▼
                    runLLMPipeline()
                    (single streaming LLM call → SSE tokens)
                           │
                           ▼
                    Frontend (ChatProvider.tsx)
```

### Data Flow
1. User message → `POST /api/chat` → `app/api/chat/route.ts:5` (Next.js Route Handler)
2. `route.ts` creates an `ObservabilityService`, starts a request trace, calls `orchestrator()`
3. `orchestrator.ts:24` calls `classifyIntent()` — regex fast-path for greetings (1ms), LLM for others (50-200ms)
4. If intent is `"portfolio"`: calls `searchPortfolio()` for two-tier retrieval
5. If intent is `greeting/out_of_scope/ambiguous`: yields guardrail response, exits
6. `searchPortfolio()` evaluates 8 regex patterns against Sanity GROQ queries; if none match, falls to `searchSemantic()` (Qdrant)
7. `buildEvidencePackage()` deduplicates, formats context, truncates to 2000 chars
8. `runLLMPipeline()` builds message array `[system prompt, evidence, history, user]`, streams LLM tokens via SSE
9. Post-generation: extracts UI actions (`[openResume]`, `[openProject:slug]`), emits evidence sources and done event

### SSE Event Types
| Event | When | Content |
|-------|------|---------|
| `token` | During LLM generation | Individual text chunks from streaming |
| `evidence` | After generation | `SearchResult[]` for frontend citations |
| `actions` | After generation | Navigation actions (openResume, openProject, scrollTo) |
| `error` | On failure | Error message |
| `done` | Stream complete | — |

### External Systems
- **Sanity CMS**: Structured data source (projects, experience, skills, site settings). Read via `sanity/client.ts`.
- **Qdrant**: Vector database (Docker, port 6333, collection `portfolio_chunks`). Semantic search backend.
- **vLLM / Ollama**: LLM inference. vLLM intended on port 8000 (non-functional: no GPU). Ollama on port 11434 (functional).
- **Langfuse**: LLM observability (traces, spans, generations). No-op when unconfigured.
- **MLflow**: Experiment tracking / run logging. Independent from Langfuse.

---

## 4. Major Engineering Components

### 4.1 Orchestrator (`lib/agent/orchestrator.ts`)
- **Responsibility**: Pipeline coordinator. AsyncGenerator sequencing intent → retrieval → evidence → generation.
- **Important files**: `lib/agent/orchestrator.ts:16-108`, `app/api/chat/route.ts:5-70`
- **Interactions**: Calls `classifyIntent()` from intent-router, `searchPortfolio()` from retrieval, `buildEvidencePackage()`, `runLLMPipeline()`. Observability spans owned: retrieval (line 52-64), evidence-package (line 79-91).
- **Design reasoning**: Thin coordination with no business logic. Early exits for guardrail intents before touching retrieval. Known bug: `tracer` (LangfuseTracer) imported at line 14 but never instantiated, causing ReferenceError on all requests (`Runtime_Request_Trace_Investigation.md` phase 6).

### 4.2 Intent Router (`lib/agent/intent-router.ts`)
- **Responsibility**: Classify user messages into 4 intents: `portfolio`, `greeting`, `out_of_scope`, `ambiguous`.
- **Important files**: `lib/agent/intent-router.ts:37-90`
- **Interactions**: Uses `ChatOpenAI` (via `getIntentModel()`) for LLM classification. Regex fast-path for greetings.
- **Design reasoning**: Two-layer classification. Regex fast-path (~1ms) for greetings. LLM (`qwen2.5:1.5b`, ~50-200ms) for everything else. `ambiguous` is a distinct intent, not a fallback to `portfolio`. Parser uses substring matching (`raw.includes(i)`), so semantically correct but schema-invalid labels like "experience" silently default to `ambiguous`.

### 4.3 Retrieval Layer (`lib/retrieval/`)
- **Responsibility**: Two-tier retrieval: structured patterns (regex → Sanity GROQ) then semantic fallback (Qdrant).
- **Important files**: `lib/retrieval/index.ts:86-98`, `lib/retrieval/semantic.ts:4-25`, `lib/retrieval/structured.ts`
- **Interactions**: `searchPortfolio()` evaluates 8 patterns in order. First non-empty handler wins. Falls to `searchSemantic()` for Qdrant vector search (k=5, cosine, 768d).
- **Pattern catalog**:
  1. `/which projects use\s+(.+)/i` → `searchByTechnology()`
  2. `/(what|which).*(technology|skill|tools|framework|library|stack).*(used|use)/i` → skills + projects
  3. `/(contact|email|linkedin|github|reach|get in touch|message)/i` → `getContactInfo()`
  4. `/(resume|cv|curriculum vitae)/i` → `getResumeUrl()`
  5. `/(experience|work history|employment|previous role|past role|career)/i` → `getExperience()`
  6. `/(skill|expertise|proficient|tech stack|technologies)/i` → `getSkills()`
  7. `/^open\s+(.+)/i` → navigation actions
  8. `/^(explain|tell me about|describe|show)\s+(.+)/i` → slug lookup
- **Known gap**: Pattern 5 matches generic experience keywords but NOT company names. Queries like "What did you do at Neilsoft?" fall through to semantic search. Semantic search with k=5 fails to surface experience chunks (`RAG_Debug_Report.md` section 7).

### 4.4 Evidence Builder (`lib/agent/evidence-builder.ts`)
- **Responsibility**: Transform raw `SearchResult[]` into formatted context + deduplicated source list.
- **Important files**: `lib/agent/evidence-builder.ts:28-43`
- **Design reasoning**: Pure function. Deduplicates by first 100 characters. Formats as structured text with project/section labels. Truncates to `MAX_CONTEXT_CHARS = 2000` with truncation notice.

### 4.5 LLM Pipeline (`lib/agent/llm-pipeline.ts`)
- **Responsibility**: Single streaming LLM call with pre-loaded evidence context.
- **Important files**: `lib/agent/llm-pipeline.ts:29-112`
- **Interactions**: Builds message array `[system prompt, evidence context, ...last 10 history]`. Streams from `ChatOpenAI.stream()`.
- **Design reasoning**: Replaced LangGraph agent (2-3 LLM calls per ReAct loop) with single direct call. Intent is "given evidence, answer the question" — no search autonomy. Extracts UI actions via regex. Captures token counts from `usage_metadata` on final stream chunk.

### 4.6 AI Provider Layer (`lib/ai/`)
- **Responsibility**: Factory functions for LLM, embedding, and vector store instances.
- **Important files**: `lib/ai/provider.ts:12-26`, `lib/ai/embeddings.ts:3-24`, `lib/ai/vector-store.ts:6-22`
- **Design reasoning**: Abstraction allows swapping providers. URL resolution chain: `VLLM_BASE_URL` → `CHAT_BASE_URL` + `/v1` → `localhost:8000/v1`. Embeddings support `ollama`, `openai`, or default `huggingface` provider via `EMBEDDING_PROVIDER`. Known bug: default was `huggingface` but `@huggingface/transformers` not in `package.json`.

### 4.7 Observability Layer (`lib/observability/`)
- **Responsibility**: Provider-agnostic tracing abstraction.
- **Important files**: `lib/observability/langfuse.ts:89-177`, `lib/observability/noop.ts:13-24`, `lib/observability/service.ts:6-23`
- **Design reasoning**: Interface-based (`ObservabilityService`). Two implementations: `LangfuseObservabilityService` and `NoopObservabilityService`. Flush with 2s timeout prevents hanging. Module-level Langfuse client singleton.

### 4.8 Ingestion Pipeline (`scripts/index-content.ts`)
- **Responsibility**: Index Sanity content into Qdrant vector database.
- **Important files**: `scripts/index-content.ts:335-411`
- **Chunking**: Five custom deterministic chunking functions. Projects: up to 8 section-based chunks. Experience: 1 monolithic chunk per entry. Skills: 1 chunk per category. Site settings: up to 5 section-based chunks. Technical notes: up to 2 chunks.
- **Known bug**: `QdrantVectorStore.fromDocuments()` does NOT clear the collection before re-indexing. Running multiple times accumulates duplicate vectors. No `npm run index-content` in `package.json`.

### 4.9 Frontend Chat (`components/Chat/`)
- **Responsibility**: SSE-consuming chat UI.
- **Important files**: `components/Chat/ChatProvider.tsx`, `components/Chat/ChatMessage.tsx`, `components/Chat/SlideOutPanel.tsx`
- **Interactions**: `ChatProvider.tsx` consumes SSE stream from `/api/chat`, renders tokens progressively. Slide-out panel shows evidence sources with citations.

---

## 5. Technologies Used

| Technology | Role | Where it appears | Why chosen |
|------------|------|-----------------|------------|
| Next.js 15 | Web framework | `app/`, `next.config.ts` | SSG/ISR; Route Handlers for API |
| React 19 | UI library | `components/` | Required by Next.js |
| TypeScript 5.8 | Type safety | All `.ts`/`.tsx` | Standard for ecosystem |
| LangChain (core, openai, ollama, qdrant) | LLM orchestration | `lib/ai/`, `lib/retrieval/`, `scripts/index-content.ts` | Provider abstraction, streaming, embeddings |
| Qdrant | Vector database | `docker-compose.yml`, `lib/ai/vector-store.ts` | Local-first, Docker deployment |
| Langfuse | LLM observability | `lib/observability/langfuse.ts`, `lib/agent/langfuse-tracer.ts` | Trace/spans for LLM debugging |
| MLflow | Experiment tracking | `docker-compose.yml`, `lib/agent/mlflow-logger.ts` | Run metrics/params |
| Ollama | Local LLM runtime | `.env.local`, `lib/ai/embeddings.ts` (fallback) | Local inference without GPU |
| vLLM | GPU LLM inference | `docker-compose.yml`, `lib/ai/provider.ts` | Intended primary (non-functional: no GPU) |
| Sanity CMS | Structured content | `sanity/` | Headless CMS with GROQ |
| Server-Sent Events | Streaming protocol | `app/api/chat/route.ts:23-47` | Progressive token delivery |

---

## 6. Architecture Decisions

### Decision 1: Retrieval-first architecture (no ReAct agent)
- **Evidence**: `docs/architecture/streaming-refactor-plan.md` lines 32-66
- **Rationale**: Mandatory pre-retrieval eliminates need for ReAct loop. No search autonomy needed. Single direct LLM call is simpler, faster, more debuggable.
- **Tradeoffs**: LLM cannot search for follow-up information beyond initial evidence.

### Decision 2: Two-tier retrieval (structured patterns → semantic fallback)
- **Evidence**: `lib/retrieval/index.ts:86-98`
- **Rationale**: Structured patterns handle common query types deterministically. Semantic search provides flexibility.
- **Tradeoffs**: Pattern matching is brittle. Company name queries fail because patterns only match generic keywords.

### Decision 3: Two-layer intent classification (regex + LLM)
- **Evidence**: `lib/agent/intent-router.ts:25-47`
- **Rationale**: Regex fast-path (~1ms) for greetings avoids unnecessary LLM calls. LLM classifier (`qwen2.5:1.5b`) for other queries. `ambiguous` fallback, never `portfolio`.
- **Tradeoffs**: LLM adds 50-200ms (but observed 11-65s with thinking model). Substring parser silently misclassifies valid semantic labels.

### Decision 4: Observability via abstracted interface
- **Evidence**: `lib/observability/types.ts:21-33`, `docs/architecture/orchestration-layer.md`
- **Rationale**: Pipeline code imports interface only, never Langfuse types. Langfuse fully confined to `lib/observability/langfuse.ts`. Swappable.
- **Tradeoffs**: Manual tracing only (no LangChain callback handler). Requires explicit span/generation instrumentation at every stage.

### Decision 5: Manual tracing only (no LangChain callback)
- **Evidence**: `docs/architecture/orchestration-layer.md` line 103
- **Rationale**: Langfuse v5 incompatible with callback handler approach. Manual gives full control.
- **Tradeoffs**: Token counts manually extracted from `usage_metadata`. Explicit instrumentation everywhere.

### Decision 6: Section-based deterministic chunking (no LangChain splitters)
- **Evidence**: `scripts/index-content.ts:117-300`
- **Rationale**: Clean, predictable chunks at known section boundaries.
- **Tradeoffs**: Experience entries are monolithic (company name <1% of chunk content). No chunk overlap.

### Decision 7: Flush timeout of 2 seconds for Langfuse
- **Evidence**: `lib/observability/langfuse.ts:165-176`
- **Rationale**: Prevents Langfuse from hanging the response.
- **Tradeoffs**: Traces may be lost if flush exceeds 2s.

---

## 7. Engineering Challenges

### Challenge 1: `tracer` Undefined ReferenceError
- **Problem**: `lib/agent/orchestrator.ts:14` imports `LangfuseTracer` but never instantiates. 6 call sites throw `ReferenceError`. Every request crashes.
- **Approach**: Discovered during runtime trace (`Runtime_Request_Trace_Investigation.md`). Fix described in `Runtime_Fix_Report.md`: instantiate `const tracer = new LangfuseTracer()`.
- **Outcome**: Fixed by adding module-scope instantiation and start/end lifecycle calls.

### Challenge 2: Missing `@huggingface/transformers` Dependency
- **Problem**: `lib/ai/embeddings.ts` creates `HuggingFaceTransformersEmbeddings` which dynamically imports `@huggingface/transformers`. Package not in `package.json`. Every `embedQuery()` throws `ERR_MODULE_NOT_FOUND`.
- **Approach**: Semantic search has never successfully executed. Error silently caught by `searchSemantic()` try/catch, returns empty results. Discovered in `Semantic_Search_Investigation.md`.
- **Outcome**: Any query falling through to semantic search silently fails. The `EMBEDDING_PROVIDER=ollama` env var was later added as a workaround.

### Challenge 3: vLLM Unreachable (No GPU)
- **Problem**: `docker-compose.yml` configures vLLM with `--gpu-memory-utilization 0.90` requiring GPU. Host has no GPU. vLLM crash-loops 130+ times with `RuntimeError: Failed to infer device type`.
- **Approach**: Documented in `Runtime_Request_Trace_Investigation.md` Appendix B. Docker proxy accepts TCP but immediately resets.
- **Outcome**: Environment reconfigured to use Ollama (port 11434) via `resolveBaseUrl()` fix.

### Challenge 4: pRetry Hangs for ~17 Minutes
- **Problem**: `ChatOpenAI` created without `timeout` or `maxRetries`. `@langchain/core` pRetry uses defaults: `retries=10`, `minTimeout=1000ms`, `factor=2`. Exponential backoff totals ~1023 seconds.
- **Approach**: Fixed in `Runtime_Fix_Report.md`: added `timeout: 180000`, `maxRetries: 1`, `maxTokens: 4096`.
- **Outcome**: LLM call failures now time out in 3 minutes.

### Challenge 5: Pattern Matching Gap for Company Names
- **Problem**: Pattern 5 matches `experience|work history|employment` but not company names. "What did you do at Neilsoft?" falls through to semantic search.
- **Approach**: Diagnosed in `RAG_Debug_Report.md`. All 8 patterns fail for "What did you do at Neilsoft?". Falls to semantic search where Neilsoft ranks 6th+ (k=5).
- **Outcome**: Company-specific queries fail silently. Recommended fixes documented (company-name matching pattern, broader experience pattern, entity extraction).

### Challenge 6: Semantic Search k=5 Too Small
- **Problem**: `lib/retrieval/semantic.ts:4` hardcodes k=5. With ~57 chunks, experience chunks are pushed out of top-5 by site settings sharing ML/AI terminology.
- **Approach**: Vector neighborhood analysis (`Semantic_Search_Investigation.md`) shows Neilsoft chunk ranks 6+ in its own semantic neighborhood.
- **Outcome**: Even with functional embedding model, experience-specific company queries would fail.

### Challenge 7: Qdrant Vector Accumulation on Re-index
- **Problem**: `QdrantVectorStore.fromDocuments()` never clears collection. Multiple runs accumulate duplicate vectors.
- **Approach**: Confirmed in `RAG_Stale_Vector_DB_Investigation.md` lines 363-427.
- **Outcome**: Current DB has 26 clean vectors (no duplication yet), but risk documented.

### Challenge 8: Experience Chunks Are Monolithic
- **Problem**: `scripts/index-content.ts:228-252` produces one chunk per experience entry. Company name "Neilsoft" appears once in ~85 words (<1% of chunk). Embedding weights toward shared ML/AI terminology.
- **Approach**: No splitting applied. Single vector per experience entry.
- **Outcome**: Poor retrieval for company-name queries.

### Challenge 9: Intent Classification Latency
- **Problem**: `qwen3:4b` has thinking/reasoning phase. Intent classification measured at 11-65 seconds per call.
- **Approach**: Noted in `Runtime_Fix_Report.md` remaining known issues. Suggested using non-thinking model.
- **Outcome**: Intent classification is pipeline bottleneck.

---

## 8. Debugging & Iteration Evidence

### Investigation Reports (all committed to repository root)
1. **RAG_Debug_Report.md** (696 lines): Root cause of experience retrieval failure. Maps 8 patterns against failing queries. Identifies pattern matching gap + tracer bug.
2. **RAG_Stale_Vector_DB_Investigation.md** (567 lines): Determines Qdrant is not stale. Identifies vector accumulation bug in `fromDocuments()`.
3. **Runtime_Request_Trace_Investigation.md** (454 lines): Runtime instrumentation of Neilsoft query. 3-bug failure chain: vLLM crash → pRetry → undefined tracer.
4. **Intent_Router_Investigation.md** (559 lines): Forensics on intent returning "ambiguous". Confirms LLM unreachable + tracer undefined.
5. **Semantic_Search_Investigation.md** (533 lines): Missing `@huggingface/transformers` + Neilsoft chunk ranking analysis.
6. **Sanity_Dataset_Indexing_Investigation.md** (522 lines): Production ≡ Local ≡ Qdrant. Falsifies "wrong dataset" hypothesis.

### Architecture Refactor Plans
- `docs/architecture/streaming-refactor-plan copy.md` (613 lines, Rev 2): Plans bounded LangGraph agent.
- `docs/architecture/streaming-refactor-plan.md` (663 lines, Rev 3): Removes LangGraph entirely. Direct LLM pipeline.

### Runtime Fixes (from `Runtime_Fix_Report.md`)
- Instantiated missing `tracer` in orchestrator
- Added timeout/maxRetries/maxTokens to ChatOpenAI
- Added `resolveBaseUrl()` for `CHAT_BASE_URL` fallback
- Added `EMBEDDING_PROVIDER` switch for Ollama embeddings
- Added structured console.error in intent-router catch block

---

## 9. Measurable Outcomes

### Latency
| Metric | Before | After | Source |
|--------|--------|-------|--------|
| Greeting TTFT | ~17 min (hang) | ~0ms (regex) | `Runtime_Fix_Report.md:145` |
| Intent classification | ~17 min → crash | 11-65s | `Runtime_Fix_Report.md:172-173` |
| pRetry hang time | ~1023s | 180s + 1 retry | `Runtime_Request_Trace_Investigation.md:345` |

### Vector Database
| Metric | Value | Source |
|--------|-------|--------|
| Qdrant points | 26 | `RAG_Stale_Vector_DB_Investigation.md:225` |
| Vector dimensions | 768 | Same, line 227 |
| Distance | Cosine | Same, line 228 |
| Estimated total | ~57 chunks | `RAG_Debug_Report.md:196-207` |

### Code Quality
| Metric | Result | Source |
|--------|--------|--------|
| TypeScript typecheck | PASSED | `Runtime_Fix_Report.md:161` |
| ESLint | 0 errors, 3 warnings | Same, line 165 |

---

## 10. Ownership Signals

- **Custom `ObservabilityService` interface**: 6 files, 700+ lines. Langfuse + Noop implementations with flush timeout.
- **Custom `LangfuseTracer` class**: Manual trace/span/generation management with graceful degradation.
- **Custom `MLflowLogger`**: REST API wrapper with batch flushing, experiment auto-creation, race-condition handling.
- **Custom two-tier retrieval router**: 8 structured patterns with fallback to Qdrant.
- **Custom evidence package builder**: Dedup, format, truncate.
- **Custom chunking functions**: 5 per document type, no LangChain splitters.
- **6 forensic investigation reports**: Each 400-700 lines with Mermaid diagrams, source-code citations, root cause matrices.
- **2 architecture refactor documents**: Migration strategies, risk matrices, file-by-file impact analysis.
- **Custom intent router**: Two-layer regex/LLM classification.
