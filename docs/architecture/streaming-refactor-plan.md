# Portfolio Assistant — Architecture Refactor Plan (Revision 3)

## Direct LLM Pipeline: Retrieval-First Architecture with Streaming

---

## Table of Contents

1. [Goal](#goal)
2. [Design Principles](#design-principles)
3. [Target Architecture Overview](#target-architecture-overview)
4. [Component Design](#component-design)
   - 4.1 Intent Router
   - 4.2 Ambiguous Query Handling
   - 4.3 Mandatory Retrieval
   - 4.4 Evidence Package Builder
   - 4.5 Static System Prompt
   - 4.6 Direct LLM Pipeline
   - 4.7 Guardrail Responses
   - 4.8 Orchestrator
   - 4.9 Streaming Architecture
5. [Request Lifecycle](#request-lifecycle)
6. [File-by-File Impact Analysis](#file-by-file-impact-analysis)
7. [Migration Strategy](#migration-strategy)
8. [Risk Analysis](#risk-analysis)
9. [Validation Strategy](#validation-strategy)

---

## Goal

Refactor the portfolio assistant from a LangGraph ReAct agent into a **direct LLM pipeline with mandatory pre-retrieval** that guarantees factual grounding.

The LangGraph agent is removed entirely. The ReAct loop provides no value once:
- retrieval is mandatory (no search autonomy)
- tools are deterministic lookups of data already in evidence context
- the single task is: "given evidence, answer the question"

The assistant is **not** intended to behave as a general-purpose chatbot.

It should answer only questions related to Aditya's:

- portfolio
- projects
- skills
- technologies
- work experience
- resume
- contact information
- blog/articles (if indexed)

Everything else should be politely declined.

---

## Design Principles

1. **Application owns policy.** The application decides scope, whether retrieval runs, and what evidence is supplied. The LLM receives bounded context and generates from it — no autonomy over search or refusal.

2. **Correctness over complexity.** Retrieval is mandatory for every portfolio question. A single direct LLM call with pre-loaded evidence is simpler, faster, and more debuggable than a multi-step agent loop.

3. **Separation of concerns.** Each component (router, retrieval, evidence builder, LLM pipeline, streamer) has a single responsibility and is independently testable.

4. **LLM-based classification.** Intent routing uses a lightweight local LLM (not regex), making it robust to paraphrasing and eliminating keyword maintenance.

5. **Streaming native.** The architecture emits SSE tokens from the first LLM stream chunk. No graph state parsing needed.

---

## Target Architecture Overview

```
                 User
                   │
                   ▼
          Intent Router (LLM-based)
                   │
        ┌──────────┴──────────┐
        │                     │
 Portfolio Request      Non-Portfolio
        │                     │
        ▼                     ▼
Mandatory Retrieval     Guardrail / Greeting / Guidance
        │
        ▼
 Evidence Package Builder
        │
        ▼
 Direct LLM Pipeline (ChatOllama.stream)
        │
        ▼
 SSE Stream → Frontend
```

**Key difference from Revision 2:** No LangGraph agent. No `createReactAgent`. No `agent.stream()`. The final stage is `ChatOllama.stream(messages)` — a single streaming LLM call.

---

## Component Design

### 4.1 Intent Router

**File:** `lib/agent/intent-router.ts` (NEW)

**Interface:**

```typescript
type Intent = "portfolio" | "greeting" | "out_of_scope" | "ambiguous";
```

**Strategy — Two-layer classification:**

**Layer 1 (fast path — regex, ~1ms):**

```
Greeting patterns: ^(hi|hello|hey|greetings|good morning|good evening)\b
                   ^(how are you|how's it going|what's up|nice to meet you)\b
```

Clear greetings are classified immediately without an LLM call. This keeps greeting TTFT at ~5ms total.

**Layer 2 (LLM classification — ~50-200ms):**

For everything that doesn't match a clear greeting, a lightweight local Ollama model classifies the intent.

```markdown
Classify the following user message into exactly one of these categories.

Categories:
- portfolio: The user is asking about someone's projects, skills, experience, resume, contact info, technologies used, or work history.
- greeting: The user is saying hello, being polite, or making casual conversation.
- out_of_scope: The user is asking about something unrelated to a personal portfolio — general knowledge, programming, weather, news, jokes, math problems, etc.
- ambiguous: The user's intent is unclear, too vague, or could be interpreted multiple ways.

Message: {user message}

Category:
```

The model used is `qwen2.5:1.5b` (or equivalent small model — already runs on the local Ollama instance). Inference is a single forward pass producing one of four tokens, which is the fastest kind of LLM call.

| Aspect | Detail |
|--------|--------|
| Model | `qwen2.5:1.5b` |
| Est. latency | 50-200ms |
| Output | Single token: `portfolio`, `greeting`, `out_of_scope`, `ambiguous` |
| Prompt size | ~100 tokens |
| Failure mode | Falls open to `ambiguous` (not `portfolio`) |

**Key behaviors:**

- The `ambiguous` intent is a distinct category, NOT a fallback to `portfolio`
- Default fallback for unrecognized queries is `ambiguous`, not `portfolio`
- The router does NOT expose `confidence` or `reasoning` fields — they aren't consumed anywhere

---

### 4.2 Ambiguous Query Handling

For `ambiguous` queries, the system does NOT invoke retrieval or the LLM pipeline.

**Response:**

> I'd be happy to help with questions about Aditya's projects, skills, experience, or portfolio. What would you like to know?

This avoids unnecessary retrieval (which would return empty results) while guiding the user toward in-scope questions.

---

### 4.3 Mandatory Retrieval

For every `portfolio` question, retrieval MUST execute before the LLM pipeline.

**Retrieval pipeline (unchanged from current):**

```
Structured Search (pattern → Sanity GROQ)
       │
       ▼
Semantic Search (fallback — Qdrant + embeddings)
       │
       ▼
Results (SearchResult[])
```

**File reused:** `lib/retrieval/index.ts` — `searchPortfolio()` called as-is.

---

### 4.4 Evidence Package Builder

**File:** `lib/agent/evidence-builder.ts` (NEW)

Transforms raw `SearchResult[]` into a formatted context block and a deduplicated source list for the frontend.

**Responsibilities:**

- merge duplicate chunks (same content from structured + semantic)
- remove redundant evidence
- preserve citations (projectTitle, slug, section, url)
- truncate to token budget (~2000 chars for initial implementation)
- order by relevance score (semantic) or specificity (structured)
- format into a clean context string

**Interface:**

```typescript
type EvidencePackage = {
  context: string;          // Formatted markdown string for LLM context
  sources: SearchResult[];  // Deduplicated, ordered sources for frontend display
  truncated: boolean;       // Whether context was cut to fit token budget
};
```

**Example formatted context:**

```
Retrieved Portfolio Information:

Project: Warehouse Parcel Monitoring System
Section: Problem Statement
Content: The warehouse faced challenges with manual parcel tracking...

Project: Warehouse Parcel Monitoring System
Section: Technologies
Content: Python, YOLOX, OpenCV, Docker, PostgreSQL, Redis
```

---

### 4.5 Static System Prompt

**File:** `lib/agent/prompts.ts` (KEPT, UPDATED)

The system prompt remains stable across requests. Evidence is NOT injected into it.

**Message structure:**

```
System:  Rules and role (static, identical every request)
Human:   User question
```

Evidence from the package builder is placed in the messages array as a separate context message before the human query.

**System prompt content:**

```
You are a grounded portfolio assistant for Aditya More — an Applied AI Engineer.

## Your Role
You synthesize and explain information from Aditya's portfolio using ONLY the
retrieved evidence provided in the context sections below.

## Grounding Rules (CRITICAL)
1. You MUST base every statement on the retrieved evidence provided.
2. If the retrieved evidence does not contain the answer, say:
   "I couldn't find that information in Aditya's portfolio."
3. Never invent, speculate, or infer information not present in the evidence.
4. Never answer from your training data. Only use provided context.
5. If evidence is partial, say what you found and what you couldn't find.

## Your Responsibilities
- Compare projects using evidence
- Synthesize information from multiple evidence sources
- Summarize findings
- Explain architecture decisions described in evidence
- Rank or recommend projects based on evidence
- Answer follow-up questions using previously retrieved context

## Response Format
Respond conversationally in markdown. When referencing evidence, mention
which project or section the information came from.

## Available Actions
When appropriate, include: [openResume], [openProject:slug], [scrollTo:section]
```

---

### 4.6 Direct LLM Pipeline

**File:** `lib/agent/llm-pipeline.ts` (NEW)

Replaces the LangGraph agent entirely. This is the core change from Revision 2.

**Behavior:**

```typescript
export async function* runLLMPipeline(
  messages: { role: string; content: string }[],
  evidencePackage: EvidencePackage
): AsyncGenerator<StreamEvent> {
  const llm = getChatModel();

  // Build message array:
  //   system (rules, static)
  //   context (evidence, dynamic)
  //   conversation history (last N)
  //   human (latest user question)
  const llmMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Retrieved Portfolio Information:\n${evidencePackage.context}` },
    ...messages.slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Single streaming LLM call — no ReAct loop, no tools, no graph
  const stream = await llm.stream(llmMessages);

  let fullText = "";
  for await (const chunk of stream) {
    const token = chunk.content as string;
    if (token) {
      fullText += token;
      yield { type: "token", content: token } as StreamEvent;
    }
  }

  // Extract navigation actions from full response
  const actions = extractActions(fullText);

  // Emit evidence and actions
  yield { type: "evidence", data: evidencePackage.sources };
  yield { type: "actions", data: actions };
}
```

**Why this replaces the agent:**

| Concern | LangGraph agent | Direct LLM pipeline |
|---------|----------------|---------------------|
| Graph compilation | ~20ms per request | 0ms |
| Tools | Must define, bind, route | None needed |
| ReAct loop | 2-3 LLM calls | 1 LLM call |
| State management | Graph state, checkpoints | Stateless messages array |
| Streaming | Parse agent.stream() events | Direct llm.stream() tokens |
| Debugging | Trace through graph nodes | Single call, single response |
| Failure modes | Tool choice, tool parsing, loop errors | One LLM generation |

---

### 4.7 Guardrail Responses

**File:** `lib/agent/prompts.ts` or constants within orchestrator

```typescript
export const GUARDRAIL_OUT_OF_SCOPE =
  "I can only answer questions about Aditya More's portfolio — his projects, skills, experience, and contact information. Would you like to ask about any of those topics?";

export const GUARDRAIL_GREETING =
  "Hi! I'm Aditya More's portfolio assistant. I can help you learn about his projects, skills, experience, and more. What would you like to know?";

export const GUARDRAIL_AMBIGUOUS =
  "I'd be happy to help with questions about Aditya's projects, skills, experience, or portfolio. What would you like to know?";

export const GUARDRAIL_NO_EVIDENCE =
  "I couldn't find that information in Aditya's portfolio.";
```

---

### 4.8 Orchestrator

**File:** `lib/agent/orchestrator.ts` (NEW)

Thin coordination layer. No business logic.

**Flow:**

```
Intent Router
       │
       ▼
  (greeting)     → yield token(guardrail_greeting), done
  (out_of_scope) → yield token(guardrail_out_of_scope), done
  (ambiguous)    → yield token(guardrail_ambiguous), done
  (portfolio)    → continue
       │
       ▼
  searchPortfolio()
       │
       ▼
  buildEvidencePackage(results)
       │
       ▼
  runLLMPipeline(messages, evidencePackage)
       │
       ▼
  For each event from pipeline: yield event
```

The orchestrator is an async generator. Every yield becomes an SSE event.

---

### 4.9 Streaming Architecture

**Execution order:**

```
Intent Classification          ← ~1-200ms
       │
Retrieval                      ← ~100-1200ms
       │
Evidence Building              ← ~2ms
       │
LLM Pipeline (streaming)       ← first token at ~1500ms
       │
SSE Stream                     ← progressive tokens
       │
Frontend                       ← incremental rendering
```

**Event types emitted over SSE:**

| Event | When | Content |
|-------|------|---------|
| `token` | During LLM generation | Individual text chunks from `ChatOllama.stream()` |
| `evidence` | After generation | `EvidencePackage.sources` for frontend citations |
| `actions` | After generation | Extracted navigation actions |
| `error` | On failure | Error message |
| `done` | Stream complete | — |

**Key streaming benefit:** No agent abstraction between the LLM and the SSE encoder. `ChatOllama.stream()` yields `AIMessageChunk` objects directly. Each chunk's `content` is forwarded as an SSE token event. This is the simplest possible streaming path.

---

## Request Lifecycle

### Current (Before)

```
request.body.messages
       │
       ▼
runAgent(messages)
       │
       ├── getChatModel()
       ├── createReactAgent()
       ├── agent.invoke()          ← ReAct loop (may call tools)
       ├── getEvidence()           ← duplicate search
       └── return result
       │
       ▼
NextResponse.json()                ← full response at once
```

### Target (After)

```
request.body.messages
       │
       ▼
 classifyIntent(lastMessage)       ← LLM-based (fast regex for greetings)
       │
       ├── "greeting"      → yield guardrail response, done
       ├── "out_of_scope"  → yield guardrail response, done
       ├── "ambiguous"     → yield guardrail response, done
       └── "portfolio"     → continue
                │
                ▼
     searchPortfolio(query)        ← ALWAYS executes
                │
                ▼
     buildEvidencePackage(results)  ← format + deduplicate + truncate
                │
                ▼
     llm.stream([                  ← single streaming call
       { role: "system", content: SYSTEM_PROMPT },
       { role: "system", content: evidenceContext },
       ...conversationHistory,
       { role: "user", content: latestQuestion },
     ])
                │
                ├── yield { type: "token", content: chunk }  ← per LLM chunk
                ├── ... (stream continues) ...
                │
                └── yield { type: "evidence", data: sources }
                    yield { type: "actions", data: actions }
                    yield { type: "done" }
                │
                ▼
     SSE ReadableStream → frontend
```

---

## File-by-File Impact Analysis

### New Files

| File | Responsibility | Complexity |
|------|---------------|------------|
| `lib/agent/intent-router.ts` | Classify user messages into `portfolio`, `greeting`, `out_of_scope`, `ambiguous` via lightweight LLM | Low-Medium |
| `lib/agent/evidence-builder.ts` | Transform `SearchResult[]` into formatted `EvidencePackage` (deduplicate, truncate, order) | Low |
| `lib/agent/llm-pipeline.ts` | Wrap `ChatOllama.stream()` — build message array, stream tokens, extract actions | Low |
| `lib/agent/orchestrator.ts` | Coordinate router → retrieval → builder → LLM pipeline → SSE events | Low |

### Removed Files

| File | Reason | Migration |
|------|--------|-----------|
| `lib/agent/graph.ts` | LangGraph `createReactAgent` no longer used | Replace with `llm-pipeline.ts` |
| `lib/agent/tools.ts` | No tools needed — retrieval happened before LLM call | Remove entirely |
| `lib/agent/types.ts` | `AgentAction`, `AgentOutput` types no longer relevant | Remove (actions extracted in pipeline) |

### Modified Files

| File | Change | Complexity | Risk |
|------|--------|------------|------|
| `lib/agent/prompts.ts` | Rewrite to static grounding rules only | Low | Low |
| `app/api/chat/route.ts` | Call orchestrator instead of `runAgent()`. Return SSE `ReadableStream`. | Medium | Medium |
| `lib/retrieval/index.ts` | No changes needed (reused as-is) | None | None |
| `lib/ai/provider.ts` | No changes needed | None | None |
| `lib/ai/embeddings.ts` | No changes needed | None | None |
| `lib/ai/vector-store.ts` | No changes needed | None | None |
| `lib/ai/index.ts` | No changes needed (barrel export) | None | None |

### Frontend Files

| File | Change | Complexity |
|------|--------|------------|
| `components/Chat/ChatProvider.tsx` | Switch from `response.json()` to SSE stream consumer | Medium |
| `components/Chat/types.ts` | Add stream event types (`token`, `evidence`, `actions`, `done`) | Low |
| `components/Chat/SlideOutPanel.tsx` | Replace loading dots with streaming cursor | Low |
| `components/Chat/ChatMessage.tsx` | No changes needed (renders content + evidence reactively) | None |

---

## Migration Strategy

### Phase 1 — Intent Router + Guardrails

**Goal:** Add LLM-based intent classification. Non-portfolio queries intercepted before any LLM generation.

**Changes:**
- Create `lib/agent/intent-router.ts`
- Update `app/api/chat/route.ts` to classify intent
- For `greeting`, `out_of_scope`, `ambiguous`: return guardrail directly
- For `portfolio`: call existing `runAgent()` unchanged

**Risk:** Very low. Non-portfolio paths isolated. Portfolio path unchanged.

**Rollback:** Remove intent routing from route handler.

### Phase 2 — Mandatory Retrieval + Evidence Builder

**Goal:** Retrieval runs before the agent. Evidence is pre-formatted.

**Changes:**
- Create `lib/agent/evidence-builder.ts`
- In route handler: call `searchPortfolio()` before agent for portfolio intent
- Pass results through `buildEvidencePackage()`
- No change to agent yet — evidence passes alongside existing flow

**Risk:** Low. Adding data before the agent doesn't change agent behavior.

**Rollback:** Remove pre-retrieval call.

### Phase 3 — Direct LLM Pipeline (Replace Agent)

**Goal:** Remove LangGraph. Replace with direct `ChatOllama.stream()`.

**Changes:**
- Create `lib/agent/llm-pipeline.ts`
- Delete `lib/agent/graph.ts`, `lib/agent/tools.ts`, `lib/agent/types.ts`
- Update route handler/orchestrator to call `runLLMPipeline()` instead of `runAgent()`
- Update `lib/agent/prompts.ts` to static grounding prompt

**Risk:** Medium. This is the core architectural change. Test thoroughly against existing query set.

**Rollback:** Restore `runAgent()` call and deleted files.

### Phase 4 — Streaming Integration

**Goal:** Full SSE streaming from orchestrator to frontend.

**Changes:**
- Create `lib/agent/orchestrator.ts` as async generator
- Update route handler to pipe orchestrator events through SSE `ReadableStream`
- Update frontend to consume SSE stream
- Handle `token`, `evidence`, `actions`, `done`, `error` events

**Risk:** Medium-High. Streaming introduces cancellation, reconnection, and rendering complexity.

**Rollback:** Toggle between streaming and JSON mode via feature flag.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM classifier misclassifies portfolio as ambiguous | Low | Medium | Ambiguous response is helpful guidance, not refusal; user can rephrase |
| LLM classifier misclassifies out-of-scope as portfolio | Low | Low | Retrieval returns empty; pipeline says "couldn't find that information" |
| LLM classifier latency adds to every request | Medium | Low | 50-200ms; only portfolio requests see it (greeting/ambiguous are instant) |
| LLM ignores evidence despite grounding prompt | Low | High | System prompt explicitly forbids speculation; test with adversarial inputs |
| Evidence package truncates important content | Medium | Low | Sort by relevance; increase budget if needed |
| Streaming frontend jank from rapid updates | Medium | Low | Throttled state updates via requestAnimationFrame |
| No tools available for follow-ups | Low | Low | Follow-ups answer from existing evidence context; tools can be added back if needed |

---

## Validation Strategy

### Functional Validation

| Test | Expected |
|------|----------|
| Greeting "Hello" → guardrail | Returns greeting, no LLM pipeline invoked |
| Out-of-scope "Solve this problem" → guardrail | Returns out-of-scope message, no LLM pipeline invoked |
| Ambiguous "Can you help?" → guidance | Returns guidance, no retrieval, no LLM pipeline |
| Portfolio "Which projects use Python?" → retrieval + LLM | Retrieval executes, LLM generates grounded answer with evidence |
| No evidence found for portfolio query | LLM says "couldn't find that information" |
| Conversation history preserved | Last 10 messages sent to LLM |
| Navigation actions extracted | `[openResume]`, `[openProject:slug]` parsed and emitted |

### Performance Validation

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| Non-portfolio TTFT | ~9000ms | <10ms (greeting), ~50-200ms (classified) | `performance.now()` in route handler |
| Portfolio TTFT | ~9000ms | ~1600-2700ms | `performance.mark()` before/after retrieval + first LLM token |
| LLM pipeline latency (total) | ~9000ms (agent) | ~6000ms (single LLM call) | `performance.mark()` around llm.stream() |
| Evidence builder | N/A | <10ms | `performance.now()` wrapper |
| Streaming overhead | N/A | <50ms | Compare streaming vs non-streaming E2E |
| Intent classifier | N/A | ~1ms (greeting regex), ~50-200ms (LLM) | `performance.now()` around classifyIntent() |

### Regression Validation

| Behavior | Must preserve |
|----------|---------------|
| Response quality | Same or better (grounded in evidence) |
| Evidence display | Identical `SearchResult[]` format for frontend |
| Navigation actions | `[openResume]`, `[openProject:slug]`, `[scrollTo:section]` still work |
| Conversation history | Last 10 messages still sent |
| Error handling | Graceful fallback on failure |

---

## Summary

```
Before:
  LangGraph ReAct agent (graph.ts, tools.ts, types.ts)
  ├── createReactAgent(llm, tools)
  ├── agent.invoke() ← ReAct loop
  ├── getEvidence()  ← duplicate search
  └── JSON response  ← no streaming

After:
  No LangGraph. No ReAct loop. No tools.
  ├── classifyIntent()       ← lightweight LLM (~50-200ms)
  ├── searchPortfolio()      ← mandatory retrieval (~100-1200ms)
  ├── buildEvidencePackage() ← format + deduplicate (~2ms)
  ├── llm.stream()           ← single streaming call (~6000ms)
  └── SSE stream             ← progressive tokens
```

The LangGraph agent is removed because mandatory pre-retrieval and the absence of search autonomy eliminate the need for a ReAct loop. A single direct `ChatOllama.stream()` call is simpler, faster, streaming-native, and easier to debug — while producing the same (or better) grounded answers.
