# Portfolio Agent

I built an evidence-grounded AI chat agent embedded in my portfolio that answers natural-language questions about my projects, skills, and experience by retrieving real content from my Sanity CMS and a vector index, and streaming a grounded LLM answer token-by-token.

---

# At a Glance

| | |
|---|---|
| Status | Live feature of my portfolio site; the assistant runtime depends on a local LLM server (Ollama/vLLM) and Qdrant, while the semantic indexing layer is hardened to production-grade transactions |
| Role | Sole Designer & Developer |
| Domain | RAG · AI Agents · LLM Application Engineering · Developer Tooling |
| Tech Stack | Next.js 15 (App Router, ISR) · TypeScript · LangChain · Qdrant · Sanity CMS · Ollama / vLLM · Langfuse · MLflow · Docker Compose |
| Interfaces | `POST /api/chat` (Server-Sent Events) · floating chat panel UI · `npm run index-content` CLI · Langfuse traces / MLflow runs (best-effort) |

---

# Key Highlights

- **Retrieval-first architecture, not an agent loop.** I replaced a LangGraph ReAct agent with a deterministic pipeline — classify intent → mandatory retrieval → build evidence → one streaming LLM call — so the application owns all policy and the LLM never gets search autonomy (`docs/architecture/streaming-refactor-plan.md`).
- **Two-tier retrieval.** Eight regex-routed GROQ handlers answer common questions ("which projects use X?", contact, resume, experience) deterministically against Sanity; novel queries fall back to Qdrant semantic search (k=5).
- **Two-layer intent routing.** A regex fast-path classifies greetings in milliseconds without any LLM cost; a lightweight LLM handles everything else, with `ambiguous` as an explicit outcome so unclear queries are never silently treated as portfolio questions.
- **Grounding enforced in the prompt and the pipeline.** A static system prompt forbids answering from training data, evidence is injected as a separate message, and the evidence builder caps context at 2,000 characters and surfaces a deduplicated source list to the UI as citations.
- **In-band UI actions.** The model emits lightweight markers (`[openProject:slug]`, `[scrollTo:section]`, `[openResume]`) inside its answer; I parse them deterministically and turn them into real navigation, keeping the control channel simple and model-agnostic.
- **Transactional, blue-green vector indexing.** `npm run index-content` rebuilds the semantic index into a temporary collection, validates it (count, embedding dimensions, semantic retrieval probes), and atomically promotes it via Qdrant aliases — production search is never partially rebuilt and never unavailable.
- **Crash recovery and single-writer safety.** A filesystem journal persists every transaction state; on restart incomplete transactions are aborted or resumed, orphaned temp collections are swept, and a stale-lock-aware lock prevents concurrent rebuilds.
- **Observability that can never break the product.** A provider-agnostic `ObservabilityService` interface isolates Langfuse in one file, and a flush-with-timeout ensures tracing can never hang a user request.

---

# Why I Built It

The repository reveals the *what* and the *how* in detail, but the original personal motivation is only partially recoverable.

What the repository clearly shows: this is the portfolio of an Applied AI Engineer, and I designed the assistant as a working demonstration of the exact disciplines I claim to work in — RAG, LLM systems, agents, and reliable AI pipelines. The assistant has to answer questions about me correctly, which forced me to take grounding and evaluation seriously rather than bolting on a canned chatbot. The commit history also shows the depth I went to: when the assistant failed, I wrote multiple forensic investigation reports (400–700 lines each) documenting root causes instead of papering over symptoms.

> Requires manual author input for the deeper personal story — why I chose to build my own portfolio product end-to-end rather than use a static site, and what the original motivating spark was.

---

# The Problem

Three engineering problems drove the design:

1. **Recruiters need fast, accurate answers about my work.** A visitor shouldn't have to crawl long project pages to find out what I built with a given technology. But a plain keyword search can't handle natural language, and an LLM answering from its training data would confidently hallucinate facts about me — the one domain where it has zero knowledge.

2. **Answers must be provably grounded and cited.** In a portfolio context, a wrong answer isn't an amusing glitch — it misrepresents my experience to someone evaluating whether to hire me. The system needed to answer *only* from content I actually publish, and show the user where each claim came from.

3. **The underlying search index could not be trusted or safely rebuilt.** The first indexing implementation appended vectors on every run, producing duplicates and stale results, and re-indexing was a destructive all-or-nothing mutation of the live index (`RAG_Stale_Vector_DB_Investigation.md`). I needed a way to rebuild semantic search that could never corrupt or take down the live assistant.

---

# What I Built

From a visitor's perspective: there's a chat button on my portfolio. Clicking it opens a floating panel where you can ask questions in plain English — "Which projects use computer vision?", "Tell me about the video captioning agent", "What's your email?" — and the agent answers conversationally, streaming text in live, then attaches a **Sources** list so you can jump to the exact project section the answer came from.

Example workflows supported by the repository:

- **"Which projects use Python?"** → the technology pattern matches, a GROQ query fetches every published project using Python, and the assistant summarizes them with citations.
- **"Tell me about the video captioning agent"** → a project-lookup handler resolves the phrase to a slug and pulls the project's structured sections as evidence.
- **"What's your email?" / "Can I see your resume?"** → deterministic handlers return contact info and the resume link.
- **"How are you?"** → the greeting fast-path answers instantly with a guardrail response, no LLM call, no retrieval.
- **"Explain this math problem"** → classified `out_of_scope` and politely declined; the assistant only talks about my portfolio.
- The answer can include action markers — for example `[openProject:warehouse-parcel-monitoring-system]` or `[scrollTo:experience]` — which the UI renders as real navigation.

Behind the panel, the agent runs over a semantic index of my portfolio content: each project is chunked deterministically by section (Short Summary, Why I Built It, The Problem, The Solution, Engineering Decisions, Results, …), and site settings, experience entries, skill categories, and technical notes are indexed too. That index is rebuilt safely with `npm run index-content`, which runs the whole rebuild as a validated, recoverable transaction.

---

# System Architecture

```
                       ┌──────────────────────────────────┐
                       │          Sanity CMS              │
                       │  project · experience · skills · │
                       │  siteSettings · technicalNote    │
                       └───────────┬──────────────────────┘
                                   │ GROQ (read)
                                   ▼
   Visitor ──► Chat Panel ──► POST /api/chat ──► orchestrator (AsyncGenerator)
   (floating UI)                (route.ts)              │
                                                       ▼
                                              classifyIntent()
                                          ┌─────────────┴──────────┐
                                          │ portfolio intent        │ greeting / out_of_scope
                                          ▼                        ▼ / ambiguous
                                       searchPortfolio()       Guardrail response
                                 ┌───────────┴──────────────┐        (hardcoded)
                                 │ Tier 1: regex → GROQ      │
                                 │   (8 deterministic         │
                                 │    handlers vs Sanity)     │
                                 │ Tier 2: Qdrant semantic    │
                                 │   search (k=5, cosine)     │
                                 └───────────┬──────────────┘
                                             ▼
                                     buildEvidencePackage()
                                     (dedup · format ·
                                      ≤2,000 chars)
                                             ▼
                                     runLLMPipeline()
                                     (single streaming call,
                                      evidence as system message,
                                      last 10 messages history)
                                             ▼
                                 SSE events: token → evidence → actions → done
                                             ▼
                                          Chat Panel
                                    (streams text, renders
                                     sources + clickable actions)

   Indexing side (offline):
   npm run index-content ──► IndexTransactionManager
        ├─ journal (state machine) + single-writer lock
        ├─ build temp collection portfolio_temp_txn_<id>
        ├─ validate: count · embedding dims · semantic probes
        ├─ promote atomically via Qdrant alias swap (blue-green)
        └─ clean up previous backing collection

   Observability (best-effort): ObservabilityService interface
        ├─ Langfuse: trace → intent-classification span → retrieval span
        │             → evidence span → generation
        └─ Noop when unconfigured; MLflow logs runs in parallel
```

### Components

- **Route handler (`app/api/chat/route.ts`)** — the only HTTP surface. It validates the message array, creates an observability service and request trace, then pipes the orchestrator's `AsyncGenerator` into an SSE `ReadableStream`. Every event is serialized as `data: {...}`.
- **Orchestrator (`lib/agent/orchestrator.ts`)** — a thin coordination layer with no business logic. It classifies intent, early-exits on guardrail intents, runs retrieval, builds the evidence package, and delegates to the LLM pipeline. All failure paths yield a typed `error` event instead of crashing the stream.
- **Intent router (`lib/agent/intent-router.ts`)** — two-layer classification into `portfolio`, `greeting`, `out_of_scope`, and `ambiguous`. Greeting regexes run first (~1 ms, zero LLM cost); otherwise a small LLM classifies, and its failure mode falls open to `ambiguous`, never `portfolio`.
- **Retrieval layer (`lib/retrieval/`)** — a router of eight regex patterns to hand-written GROQ handlers (technology lookup, skills, contact, resume, experience, open commands, project-by-slug), falling back to Qdrant cosine similarity via `searchSemantic()` when no pattern matches. The first non-empty result set wins.
- **Evidence builder (`lib/agent/evidence-builder.ts`)** — a pure function that deduplicates results (by first 100 characters), formats each into a labeled `Project: / Section: / Content:` block, and truncates to a 2,000-character budget with an explicit truncation notice.
- **LLM pipeline (`lib/agent/llm-pipeline.ts`)** — one streaming call against an OpenAI-compatible server. The message array is `[static system prompt, evidence context, last 10 messages]`. It relays tokens as they stream, captures token usage, extracts UI action markers via regex, and finally emits `evidence` and `actions` events.
- **AI providers (`lib/ai/`)** — factory functions for the chat model, embeddings, and vector store. The chat model is `ChatOpenAI` pointed at vLLM or Ollama (temperature 0, 180 s timeout, 1 retry, 4096 max tokens); embeddings support `ollama` and `openai` providers.
- **Index transaction manager (`lib/indexing/transaction/manager.ts`)** — the state machine behind `npm run index-content`. It builds the index into a temp collection, validates it, promotes it atomically via Qdrant aliases, and records every transition in a filesystem journal.
- **Observability (`lib/observability/`)** — an interface with two implementations (`LangfuseObservabilityService`, `NoopObservabilityService`), plus an independent `MLflowLogger` REST wrapper. All are best-effort.
- **Chat UI (`components/Chat/`)** — `ChatProvider` consumes the SSE stream and accumulates tokens into the assistant message; `ChatMessage` renders markdown, strips action markers, and shows the Sources list; `ChatInput` provides the auto-growing textarea.

---

# Why This Architecture?

### Retrieval-first pipeline instead of a ReAct agent

**Why:** The task is narrow — "given evidence, answer a question about the portfolio." I realized once retrieval is mandatory and there is no search autonomy, a ReAct loop adds nothing: no tools to call, no multi-hop reasoning, just latency and failure modes (tool parsing, loop errors, graph state). My refactor plan compared the two head-to-head and chose the direct path (`docs/architecture/streaming-refactor-plan.md`).

**Alternatives:** LangGraph agent with tool bindings (what I had built first — commit `6d3f719` "Added agentic capability").

**Benefits:** Half the LLM calls (one vs. 2–3 per ReAct turn), no graph-compilation overhead, native streaming straight from `llm.stream()`, and a single call to debug. **Tradeoff:** the assistant can't go fetch information beyond the initial evidence in a single turn; follow-ups are answered from the retained context.

### Two-tier retrieval: deterministic first, semantic as fallback

**Why:** Many common portfolio questions are fully resolvable with a deterministic GROQ query — "what's your email?", "which projects use Python?" — and I'd rather give a correct, fast answer than hope embeddings rank the right chunk first.

**Benefits:** Exact, auditable answers for common intents; the LLM only runs semantic search when needed. **Tradeoff:** pattern matching is brittle — I documented a real gap where company-name questions ("what did you do at Neilsoft?") matched no pattern and ranked too low in semantic search to surface.

### Two-layer intent classification

**Why:** Greetings are the most common and cheapest query to serve. Classifying them with an LLM wastes latency and tokens, so a couple of regexes short-circuit them. Everything else goes to a small classification LLM that returns one of four tokens — the fastest kind of LLM call.

**Why `ambiguous` exists as an outcome:** rather than guessing that a vague query is portfolio-related (which wastes retrieval and risks a non-answer), the system guides the user toward in-scope questions. LLM failure also falls open to `ambiguous`, never `portfolio`.

### Evidence as a separate system message, static prompt

**Why:** The system prompt is identical for every request; evidence changes per request. Keeping them as separate messages keeps the static prompt cacheable and makes it obvious to anyone reading the code which part is policy and which part is data.

### In-band UI actions as text markers

**Why:** I could have used structured tool-calling or JSON mode, but a lightweight in-band marker (`[openProject:slug]`) survives any model and any provider, is deterministic to parse, and reads naturally inside an answer. I strip the markers before rendering and execute them on the client.

### Provider abstraction for LLMs and embeddings

**Why:** I run the stack both with vLLM (GPU, intended) and Ollama (CPU fallback), and embeddings can come from Ollama or OpenAI. A tiny factory layer with an env-driven resolution chain (`VLLM_BASE_URL` → `CHAT_BASE_URL` + `/v1` → localhost) means the application code never cares which inference server is running.

### Blue-green transactional indexing

**Why:** Rebuilding a live semantic index in place is unsafe — a crash mid-embedding, or a duplicate-vector bug, corrupts the search the assistant depends on. I modeled the rebuild after blue-green deployments: build into a temp collection, validate, then flip an alias. The stable `QDRANT_COLLECTION` name is an alias pointing at the current backing collection, so application code is permanently decoupled from physical collection names.

### Provider-agnostic observability interface

**Why:** I integrate both Langfuse and MLflow, and I didn't want pipeline code to know about either. The agent layer imports an interface; Langfuse is confined to one file, and everything degrades to a no-op when unconfigured. A flush-with-timeout (via `Promise.race`) guarantees tracing can never hang a user response.

---

# Engineering Decisions

These are the decisions I made because of constraints and evidence I gathered, not defaults:

- **The application owns policy; the LLM owns wording.** Scope, retrieval, and refusal are all decided in TypeScript before the LLM ever runs. This is the central idea that made the system correct rather than clever — the assistant can't be talked into answering outside its domain because the domain check never involves the model.
- **Hard grounding rules in the system prompt.** "Never answer from your training data. Only use provided context. If evidence is partial, say what you found and what you couldn't find." Combined with a `no_evidence` early-exit in the orchestrator that never even calls the LLM, this makes "I couldn't find that information" the honest, correct outcome rather than a hallucination.
- **Deterministic, section-based chunking instead of a generic splitter.** I write each chunk at a known semantic boundary (a project section), and I attach `projectTitle`, `slug`, `section`, and a deep-link `url` as metadata. This makes retrieval results self-describing (the UI can render a section link without any guesswork) and keeps the index explainable.
- **`temperature: 0` for both classification and generation.** For a fact-answering product, determinism matters more than creativity.
- **Alias-aware Qdrant client via a `Proxy`.** LangChain's `QdrantVectorStore.ensureCollection()` only lists real collections via `getCollections()`, so after I made the production name an alias, the library would have tried to (re)create a collection whose name is an alias. I wrapped the client in a Proxy that merges aliases into the `getCollections()` result so the vector store treats the production name as existing — application code keeps working untouched.
- **A journal as a transaction state machine, not a log.** Each `TransactionRecord` is a first-class state (`building → validating → promoting → committed | failed | aborted`) persisted to `.state/index-transactions/`, with provenance (trigger, initiator, embedding model, sha256 content revision). This is what makes crash recovery deterministic — on restart I can tell exactly where a transaction stopped.
- **Single-writer lock that breaks itself when stale.** A lock file records pid + timestamp; on acquisition it's reclaimed if the owner is dead or older than 30 minutes. Sufficient for my single-agent workflow, and documented as needing a real lease before concurrent API-driven publishing.
- **Bootstrap migration of a legacy real collection.** When the production name was a real collection (not yet an alias), I convert it to an alias atomically via Qdrant's batch operations endpoint (`POST /collections/operations`) — delete legacy + create alias in one server-side call — with a fallback for older servers so search availability is never interrupted.

---

# Interesting Engineering Challenges

## Challenge — Replacing a LangGraph ReAct agent without losing capability

### Problem

My first "agentic" implementation was a LangGraph ReAct agent (commit `6d3f719`). It worked, but it was paying the full cost of an agent loop — graph compilation, tool binding, 2–3 LLM calls per turn, complex streaming events to parse — for a task that never needed tool autonomy. Worse, correctness depended on the model deciding to search.

### Solution

I wrote a three-revision refactor plan and landed on Rev 3: remove the graph entirely. Retrieval became mandatory application code, evidence is pre-built and injected, and the model does one streaming call. All refusal and scoping logic moved out of the model into `intent-router` and the orchestrator.

### Outcome

The pipeline became a single streaming call: simpler, faster, streaming-native, and debugger-friendly (one request, one generation to trace). The tradeoff I accepted — no within-turn search autonomy — is documented in the plan rather than being an accident.

## Challenge — An LLM call that could hang the site for ~17 minutes

### Problem

In early runtime tracing I found that `ChatOpenAI` was created without a timeout or retry cap. LangChain's pRetry used its defaults (10 retries, exponential backoff), so a dead inference server meant a single request could stall for ~17 minutes before failing (`Runtime_Request_Trace_Investigation.md`).

### Solution

I configured the client explicitly: `timeout: 180000`, `maxRetries: 1`, `maxTokens: 4096`, and added a `resolveBaseUrl()` fallback chain so the client can point at Ollama when vLLM is down.

### Outcome

Failures now surface in ~3 minutes with a typed error event instead of hanging the chat; the runtime fix report documents the before/after.

## Challenge — Semantic search silently failing (missing embedding dependency)

### Problem

Semantic search had never successfully executed: the embeddings layer dynamically imported `@huggingface/transformers`, which wasn't installed, and `searchSemantic()` swallowed the error and returned empty results — so the whole semantic tier was a silent no-op (`Semantic_Search_Investigation.md`).

### Solution

I traced it to the missing dependency, then made a provider decision rather than a quick fix: I deprecated the HuggingFace serverless path entirely and switched to `ollama` and `openai` embedding providers via an `EMBEDDING_PROVIDER` env switch (commits `f33dcfd`, `37a777d`). The deprecated path now throws an explicit, actionable error instead of silently failing.

### Outcome

Semantic retrieval became functional and configurable, and the root cause is documented so it can't silently regress.

## Challenge — The orchestrator crashing on every request (undefined `tracer`)

### Problem

During a runtime trace I found a `ReferenceError`: the orchestrator imported `LangfuseTracer` but never instantiated it, so every chat request crashed at the first tracing call. This was one of three bugs in a single failure chain (`Runtime_Request_Trace_Investigation.md`).

### Solution

Instantiated the tracer at module scope with a full start/end lifecycle, and made every tracing call best-effort with try/catch so tracing can never break a request.

### Outcome

Requests stopped crashing, and I later replaced this bespoke tracer with the provider-agnostic `ObservabilityService` so the pipeline no longer touches Langfuse types directly.

## Challenge — vLLM crash-looping on a GPU-less host

### Problem

My Docker compose configured vLLM with `--gpu-memory-utilization 0.90`, but the host had no GPU. vLLM crash-looped repeatedly; the HTTP proxy accepted connections then immediately reset them, and intent classification was effectively dead.

### Solution

I made the LLM provider configurable — `CHAT_BASE_URL`/`CHAT_API_KEY` resolve to an OpenAI-compatible endpoint and the client falls back to a local Ollama URL when vLLM isn't used. Docker compose keeps vLLM as a documented (commented) option for GPU hosts.

### Outcome

The assistant runs on a CPU host via Ollama while remaining GPU-ready, all through environment configuration with no code changes.

## Challenge — Re-indexing corrupting the live search index

### Problem

The original `index-content` used `QdrantVectorStore.fromDocuments()`, which appends rather than replaces — every rebuild accumulated duplicate vectors, and a full rebuild was an unsafe destructive mutation of the collection the assistant reads from (`RAG_Stale_Vector_DB_Investigation.md`).

### Solution

I built `IndexTransactionManager`, an application-level transaction: create a temp collection `portfolio_temp_txn_<id>`, embed all documents into it, validate it (collection exists, expected vs. indexed count, embedding dimensions, generic + content-aware semantic retrieval probes), then atomically promote it by repointing the production alias, and finally clean up the previous backing collection outside the committed transaction.

### Outcome

Production always points at a fully validated index and is never exposed to a partial build; failed transactions never touch production. `recover()` aborts/resumes incomplete transactions and sweeps orphaned temp collections on restart.

## Challenge — Making the vector store work with aliases

### Problem

Once the production collection name became an alias (blue-green), LangChain's `QdrantVectorStore.ensureCollection()` — which checks only real collections via `getCollections()` — would try to (re)create a collection whose name is an alias and fail.

### Solution

I wrapped the Qdrant client in a `Proxy` that intercepts `getCollections()` and merges alias names into the reported collection list, making the store treat the production name as existing. This is documented in a code comment explaining exactly why the proxy exists.

### Outcome

Application code references the stable `QDRANT_COLLECTION` name and works whether it's a real collection or an alias — permanently decoupled from physical collection names.

## Challenge — Company-name questions returning nothing

### Problem

The structured patterns match generic experience keywords but not company names, and semantic search (k=5) didn't rank the monolithic experience chunk high enough — so "What did you do at Neilsoft?" fell through to semantic search and missed. I documented this thoroughly across `RAG_Debug_Report.md` and `Semantic_Search_Investigation.md`, including a vector-neighborhood analysis showing the chunk ranking 6th+ in its own neighborhood.

### Solution

I diagnosed the two compounding causes: a pattern gap and experience chunks that are monolithic (the company name is a tiny fraction of the chunk's tokens, so the embedding is dominated by shared ML/AI terminology). Fixes were documented but not fully implemented at the time.

### Outcome

This remains a known, documented limitation — an honest example of where I traced a failure to its root cause and recorded the fix path rather than leaving a silent bug.

## Challenge — Intent classification latency from a reasoning model

### Problem

Using a model with a thinking phase made intent classification the pipeline bottleneck — measured in tens of seconds in the runtime fix report.

### Solution

The classifier now uses a small, non-reasoning model (`qwen2.5:1.5b` / `gpt-4o-mini`), which is a single forward pass producing one of four tokens.

### Outcome

Classification latency dropped from the worst-case tens of seconds to the designed 50–200 ms envelope, and it can be tuned by env var (`INTENT_MODEL`).

---

# Project Evolution

The git history shows a clear arc from "make the site" to "make the site intelligent," then to "make the intelligence safe":

1. **Jun 2026** — Portfolio site foundation: Sanity schema, homepage, doc pages, markdown rendering, lightbox (`ab146dd` → `9e39b5d`).
2. **Jul 14 2026** — Agentic groundwork: experiment harness with MLflow (`c2a9107`), dataset sync tools, spec-driven project creation, and the first LangGraph agentic capability (`6d3f719`).
3. **Jul 16 2026** — The assistant: end-to-end chat with LangChain, Qdrant, and Ollama (`aef5f85`); the same day I refactored it to the retrieval-first streaming LLM pipeline and removed LangGraph (`dced397`); then switched intent classification to vLLM (`947fad2`).
4. **Jul 17 2026** — Observability: MLflow run logging (`f0a59a0`), Langfuse tracing (`73bae30`), then the provider-agnostic `ObservabilityService` refactor (`6877320`).
5. **Jul 20–24 2026** — Hardening: intent-router bug fix, Vercel analytics, and the embedding-provider rework that deprecated HuggingFace in favor of Ollama/OpenAI after the semantic-search failure.
6. **Jul 30 – Aug 1 2026** — Data-integrity: schema update, modularizing the monolithic `index-content`, then the transactional indexing layer with aliases, single-writer lock, and semantic validation (`4f434eb`, `fd1c00d`, `4c00f23`).

Compatibility/legacy evidence in the codebase: the journal auto-migrates from the legacy `.agents/index-txns/` location to `.state/index-transactions/`; the deprecated HuggingFace embedding path throws an explicit error; the bootstrap alias migration exists specifically to convert a pre-alias "real" collection without downtime.

---

# Results

I won't invent metrics I didn't measure. The measurable results documented in the repository's own investigation reports:

- **Greeting time-to-first-token** dropped from a ~17-minute hang to effectively instant via the regex fast-path (documented in `Runtime_Fix_Report.md`).
- **LLM failure time** was bounded from ~17 minutes of retry backoff (~1,023 s) to a 180 s timeout with a single retry.
- **Semantic search** went from a silent no-op (missing dependency) to a functional, provider-configurable tier.
- **Indexing** moved from append-only (duplicate-vector risk) to transactional blue-green with validated promotion and crash recovery.

Design parameters that are real and reproducible from the code:

- 4 intents · 8 structured patterns · semantic fallback at k=5 · evidence budget 2,000 chars · 10-message conversation history · exactly 1 streaming LLM call per portfolio answer · guardrail responses cost zero LLM calls.

Functional outcomes: the assistant answers portfolio questions with citations and clickable navigation, politely refuses out-of-scope queries, and can rebuild its own search index without ever taking the live index down.

---

# Technologies

| Category | Technologies |
|---|---|
| Languages | TypeScript, SQL-less GROQ |
| Framework | Next.js 15 (App Router, Route Handlers, ISR), React 19, Tailwind CSS |
| AI | LangChain (core/openai/ollama/qdrant), OpenAI-compatible client (`ChatOpenAI`), Ollama, vLLM, embedding providers (ollama/openai) |
| Vector Database | Qdrant (aliases, batch operations, cosine similarity) |
| Content | Sanity CMS (Content Lake, GROQ, embedded Studio) |
| Infrastructure | Docker Compose, local-first inference (Ollama/vLLM) |
| Observability | Langfuse (traces/spans/generations), MLflow (runs/metrics/params via REST) |
| Streaming | Server-Sent Events (SSE) |
| Tooling | npm scripts (`index-content`, lint, typecheck, build), tsx, ESLint, TypeScript |
| Testing | No automated test suite in the repository; validation is via the refactor plan's validation matrix, runtime investigation reports, and transactional semantic probes |

---

# What This Project Demonstrates

This project demonstrates my experience with:

- **RAG system design** — two-tier retrieval, deterministic chunking, evidence packaging, and grounding that prevents the LLM from answering from training data.
- **Hallucination mitigation as an engineering problem** — scope control in application code, not just prompt wording, with guardrail early-exits that never involve the model.
- **Streaming LLM applications** — turning an async-generator pipeline into a clean SSE protocol with typed events for tokens, citations, and UI actions.
- **Agent orchestration judgment** — building an agent, then deliberately removing it when the ReAct loop stopped earning its cost, and documenting why.
- **Reliable AI data pipelines** — transactional, validated, recoverable vector indexing with zero-downtime promotion, plus the crash-recovery machinery to back it up.
- **Provider abstraction and integration** — swapping LLM/embedding backends via environment, and layering observability (Langfuse, MLflow) without coupling it to the product.
- **Deep failure investigation** — writing forensic root-cause reports that trace multi-bug failure chains instead of patching symptoms.

---

# Tradeoffs

- **Deterministic-first retrieval is brittle against phrasing.** Eight patterns cover common intents precisely but miss legitimate questions (company names being the documented example). I accepted this because the deterministic path is correct and auditable; the semantic tier catches the rest — imperfectly.
- **No within-turn search autonomy.** The assistant answers from the evidence gathered at the start of the turn. This is simpler and safer, at the cost of not being able to retrieve follow-up facts mid-answer.
- **Single-writer lock suits a single-agent workflow.** It's a file lock with stale detection, not a distributed lease. I documented that concurrent API-driven publishing would need a real lease mechanism.
- **Manual observability instrumentation.** I chose explicit spans/generations over a LangChain callback handler (Langfuse v5 incompatibility plus control), which means every stage must be instrumented by hand and token counts are extracted from `usage_metadata` manually.

---

# Performance Optimizations

- Greeting regex fast-path: the most common query type served with zero LLM calls and ~1 ms cost.
- Single streaming LLM call instead of a multi-step agent loop (fewer calls, no graph compilation).
- Evidence capped at 2,000 characters to bound the prompt; only the last 10 messages are carried as history.
- LLM client tuned with explicit timeout/retry caps so failures fail fast.
- Static system prompt kept separate from evidence so the policy part stays cacheable.
- A small classifier model chosen specifically to keep intent classification to a single fast forward pass.

---

# Failure Recovery

- **Orchestrator-level:** every failure path emits a typed `error` event; the route handler wraps the whole generator so a thrown error becomes an SSE error event, never a dead connection.
- **Observability-level:** tracing is best-effort with try/catch everywhere, a no-op implementation when unconfigured, and a flush-with-timeout so telemetry can't delay a response.
- **Indexing-level:** a filesystem journal persists each transaction state; `recover()` on startup aborts interrupted transactions, resumes ones whose promotion already applied, and sweeps orphaned temp collections. Stale locks (dead pid or >30 min old) are broken automatically. Failed transactions are rolled back (temp collection discarded) and never touch the production alias.

---

# Validation Strategy

- **Transactional semantic probes:** `index-content` refuses to promote a temp collection until a generic embedding probe and content-aware probes (each project's title as a query, expecting the top-3 results' payloads to reference it) return matches.
- **Structural validation before promotion:** expected vs. indexed document count must match, and the collection's vector dimension must equal the embedding model's output dimension.
- **Refactor validation matrix:** the streaming refactor plan defines expected behavior per intent, guardrail, evidence, and action path.
- **Runtime investigation reports:** five forensic reports trace specific failing queries (e.g., the Neilsoft question) through the full stack to root cause.
- **No automated test suite** exists in the repository — validation is exercised through the investigation reports, typecheck, lint, build, and the transactional probes.

---

# Observability

- **Provider-agnostic service:** an `ObservabilityService` interface with Langfuse and no-op implementations; pipeline code imports only the interface.
- **Trace structure:** one trace per request (`chat-request`) with spans for intent classification, retrieval, and evidence building, plus a generation for the LLM call — each carrying model, temperature, token usage, and latency.
- **MLflow in parallel:** a lightweight REST wrapper stages params/metrics in memory and flushes them as a batch per run, auto-creating the experiment. MLflow and Langfuse are independent side-effects; neither depends on the other and neither can fail a user request.
- **Index provenance:** every transaction records trigger, initiator, embedding model, and a sha256 revision of the indexed content, linking content changes to index versions.

---

# Scalability

- The semantic index is rebuilt transactionally and decoupled from physical collection names, so scaling up content (more projects, notes, sections) is a matter of re-running `index-content` — promotion is atomic regardless of index size.
- Retrieval is read-only over Qdrant and CDN-backed Sanity, so the read path scales independently of writes.
- The current single-writer lock is the explicit scaling boundary for concurrent indexing; I documented the lease-based upgrade path.

---

# Future Improvements

These come from the repository's own evidence rather than speculation:

- **Company-name / entity-aware experience retrieval** — the documented pattern gap and monolithic experience chunking remain the assistant's weakest retrieval case (`RAG_Debug_Report.md`, `Semantic_Search_Investigation.md`).
- **Automated test suite** — validation currently relies on manual investigation reports and transactional probes; regression tests would harden the intent router and retrieval routing.
- **Real lease-based locking** before any concurrent, API-driven indexing (`AGENTS.md`).
- **Indexing technical notes with full bodies** — only short summaries and tags are chunked today (`lib/indexing/chunkers.ts`).
