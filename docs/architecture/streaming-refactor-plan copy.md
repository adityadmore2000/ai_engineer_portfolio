# Portfolio Assistant — Architecture Refactor Plan (Revision 2)

## Bounded, Retrieval-First Architecture with Streaming

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
   - 4.6 Bounded LangGraph Agent
   - 4.7 Tool Set
   - 4.8 Orchestrator
   - 4.9 Streaming Architecture
5. [Request Lifecycle](#request-lifecycle)
6. [File-by-File Impact Analysis](#file-by-file-impact-analysis)
7. [Migration Strategy](#migration-strategy)
8. [Risk Analysis](#risk-analysis)
9. [Validation Strategy](#validation-strategy)

---

## Goal

Refactor the portfolio assistant from a fully autonomous ReAct agent into a **bounded, retrieval-first architecture** that guarantees factual grounding while preserving the reasoning capabilities of LangGraph.

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

1. **Application owns policy. Agent owns reasoning.**

   The application decides:
   - whether the query is in scope
   - whether retrieval is required
   - what evidence is supplied

   The agent decides:
   - how to synthesize
   - how to explain
   - how to compare
   - how to summarize

2. **Correctness over autonomy.** Retrieval is mandatory for every portfolio question. The agent never answers from training data.

3. **Separation of concerns.** Each component (router, retrieval, evidence builder, agent, streamer) has a single responsibility and is independently testable.

4. **Deterministic routing.** Intent classification uses application-level logic, not LLM judgment.

5. **Streaming compatible.** The architecture is designed for SSE streaming from day one.

---

## Target Architecture Overview

```
                 User
                   │
                   ▼
          Intent Router
                   │
        ┌──────────┴──────────┐
        │                     │
 Portfolio Request      Non-Portfolio
        │                     │
        ▼                     ▼
Mandatory Retrieval     Guardrail / Greeting
        │
        ▼
 Evidence Package Builder
        │
        ▼
 Bounded LangGraph Agent
        │
        ▼
 Streaming Response
```

---

## Component Design

### 4.1 Intent Router

**File:** `lib/agent/intent-router.ts` (NEW)

**Interface:**

```typescript
type Intent = "portfolio" | "greeting" | "out_of_scope" | "ambiguous";
```

The router is designed to be **pluggable**. The initial implementation uses deterministic pattern matching for speed, but the architecture allows replacing it later with:

- lightweight classifier
- local small LLM
- embedding classifier
- hybrid classifier

without affecting the rest of the system.

**Initial strategy (pattern matching):**

| Pattern Category | Examples | Classification |
|-----------------|----------|----------------|
| Greeting | `^(hi\|hello\|hey\|greetings\|good morning)\b` | `greeting` |
| Out-of-scope | `^(solve\|write\|implement)\b.*`, `leetcode\|weather\|news\|joke` | `out_of_scope` |
| Portfolio keywords | project names, technologies, "resume", "experience", "skills", "contact" | `portfolio` |
| Short ambiguous | "Can you help me?", "What?", "I have a question" | `ambiguous` |
| No match, long query | Default fallback for queries without clear markers | `ambiguous` |

**Key behavior:**

- Never exposes `confidence` or `reasoning` fields unless a consumer actually needs them
- The `ambiguous` intent is a distinct category, NOT a fallback to `portfolio`
- Default fallback for unrecognized queries is `ambiguous`, not `portfolio`

---

### 4.2 Ambiguous Query Handling

For `ambiguous` queries, the system does NOT invoke retrieval or the agent.

**Example:**

```
User: "Can you help me?"

Response: "I'd be happy to help with questions about Aditya's projects,
           skills, experience, or portfolio. What would you like to know?"
```

This avoids unnecessary retrieval (which would return empty results) while providing a helpful UX that guides the user toward in-scope questions.

---

### 4.3 Mandatory Retrieval

For every `portfolio` question:

**Retrieval MUST execute before the agent.**

The agent never decides whether retrieval is necessary.

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

**File reused:** `lib/retrieval/index.ts` — `searchPortfolio()` is called as-is.

---

### 4.4 Evidence Package Builder

**File:** `lib/agent/evidence-builder.ts` (NEW)

Rather than injecting raw `SearchResult[]` objects directly into the agent, a dedicated formatting layer transforms them into a readable, token-budgeted context block.

**Responsibilities:**

- merge duplicate chunks (same content from structured + semantic)
- remove redundant evidence
- preserve citations (projectTitle, slug, section, url)
- truncate to token budget (~2000 chars for initial implementation)
- order by relevance score (semantic) or specificity (structured)
- format `SearchResult[]` into a clean markdown string for the agent

**Input:** `SearchResult[]`

**Output:** `EvidencePackage`

```typescript
type EvidencePackage = {
  context: string;          // Formatted markdown string for agent consumption
  sources: SearchResult[];  // Deduplicated, ordered sources for frontend
  truncated: boolean;       // Whether the context was truncated to budget
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

This creates a clean contract between retrieval and reasoning. The agent receives human-readable, pre-formatted evidence instead of raw objects.

---

### 4.5 Static System Prompt

**File:** `lib/agent/prompts.ts` (UPDATED)

**Do NOT inject retrieved evidence into the system prompt.**

The system prompt remains stable across requests and contains only:

- assistant role definition
- grounding rules
- response guidelines
- formatting instructions

**Message structure:**

```
System:
  Rules and role (static)

Human:
  User question

Context:
  Retrieved evidence (dynamic, formatted by Evidence Package Builder)
```

or any equivalent message structure supported by LangGraph.

**Rationale:**

- System prompt stays cacheable (identical across requests)
- Evidence is clearly separated for debugging
- No prompt reconstruction overhead per request

---

### 4.6 Bounded LangGraph Agent

**File:** `lib/agent/graph.ts` (UPDATED)

**The agent is stripped of policy responsibilities. It only handles reasoning.**

| Before (autonomous) | After (bounded) |
|---------------------|-----------------|
| Decides whether to search | Receives pre-retrieved evidence |
| Decides question scope | Scope already determined by router |
| Decides to refuse | Refusal handled by router/guardrails |
| Answers from training data possible | Must use evidence (grounding prompt) |
| Post-hoc `getEvidence()` duplicate | Evidence passed once from builder |

**Agent responsibilities after refactor:**

- synthesize information from evidence
- compare projects
- summarize evidence
- rank projects based on criteria
- explain architecture decisions
- answer follow-up questions using retrieved context
- produce grounded markdown responses

**The agent no longer:**

- decides whether retrieval is required
- decides whether a question belongs to the portfolio
- decides whether to refuse requests

---

### 4.7 Tool Set

**File:** `lib/agent/tools.ts` (UPDATED)

The `search_portfolio` tool is **removed** from the default tool set. Because mandatory retrieval already ran before the agent executes, the agent does not need to search again.

**Remaining tools:**

| Tool | Function | When used |
|------|----------|-----------|
| `get_project_detail(slug)` | Fetches full project detail from Sanity | Follow-up: "Tell me more about the OCR project" |
| `get_resume_url()` | Returns resume URL | Follow-up: "Open your resume" |
| `get_contact_info()` | Returns email, LinkedIn, GitHub | Follow-up: "What's your LinkedIn?" |

**Future:** If multi-turn conversations require additional retrieval during reasoning (e.g., "and what about your other projects?"), `search_portfolio` can be reintroduced selectively.

---

### 4.8 Orchestrator

**File:** `lib/agent/orchestrator.ts` (NEW)

The orchestrator is intentionally **thin**. Its only responsibility is coordination.

**Flow:**

```
Intent Router
       │
       ▼
  (greeting)    → return greeting response
  (out_of_scope) → return guardrail response
  (ambiguous)   → return guidance response
  (portfolio)   → continue
       │
       ▼
  searchPortfolio()  ← mandatory retrieval
       │
       ▼
  buildEvidencePackage() ← formatting layer
       │
       ▼
  runAgentStream(messages, evidencePackage) ← bounded agent
       │
       ▼
  SSE stream ← frontend
```

**The orchestrator does NOT contain:**

- routing logic (delegates to Intent Router)
- retrieval logic (delegates to `searchPortfolio`)
- formatting logic (delegates to Evidence Package Builder)
- prompt logic (delegates to Agent)

This keeps each component independently testable.

---

### 4.9 Streaming Architecture

**Unchanged** from the previous streaming plan.

**Execution order:**

```
Intent Classification    ← immediate
       │
Retrieval                ← ~100-1200ms
       │
Evidence Building        ← ~2ms
       │
Agent (streaming)        ← first token at ~1500ms
       │
SSE Stream               ← progressive tokens
       │
Frontend                 ← incremental rendering
```

**Event types emitted over SSE:**

| Event | When | Content |
|-------|------|---------|
| `token` | During agent generation | Individual text chunks |
| `evidence` | After generation | `EvidencePackage.sources` |
| `actions` | After generation | Extracted navigation actions |
| `error` | On failure | Error message |
| `done` | Stream complete | — |

**Streaming begins as soon as the final grounded generation starts.** The frontend receives tokens progressively.

---

## Request Lifecycle

### Current (Before)

```
request.body.messages
       │
       ▼
runAgent(messages)
       │
       ├── getChatModel()                 ← new ChatOllama
       ├── createReactAgent()             ← new graph
       │
       ├── agent.invoke()                 ← ReAct loop (autonomous)
       │     ├── LLM decides: search or not?
       │     ├── Tool: search_portfolio (maybe)
       │     └── LLM generates answer
       │
       ├── getEvidence()                  ← duplicate search
       │     └── searchPortfolio()
       │
       ├── extractActions()
       └── return { content, evidence, actions }
       │
       ▼
NextResponse.json()                       ← full response at once
```

### Target (After)

```
request.body.messages
       │
       ▼
 classifyIntent(lastMessage)
       │
       ├── "greeting"      → return greeting (no agent)
       ├── "out_of_scope"  → return guardrail (no agent)
       ├── "ambiguous"     → return guidance (no agent)
       └── "portfolio"     → continue
                │
                ▼
     searchPortfolio(query)              ← ALWAYS executes
                │
                ▼
     buildEvidencePackage(results)       ← format + deduplicate
                │
                ▼
     runAgentStream(messages, evidence)  ← bounded agent
                │
                ├── LLM receives: rules (system) + evidence (context) + question (human)
                ├── LLM generates answer (token by token)
                │     └── Tokens streamed via SSE
                │
                └── After generation:
                      ├── Emit evidence (from Evidence Package Builder)
                      ├── Emit actions
                      └── Emit done
```

---

## File-by-File Impact Analysis

### New Files

| File | Responsibility | Complexity |
|------|---------------|------------|
| `lib/agent/intent-router.ts` | Classify user messages into `portfolio`, `greeting`, `out_of_scope`, `ambiguous` | Low |
| `lib/agent/evidence-builder.ts` | Transform `SearchResult[]` into formatted `EvidencePackage` | Low |
| `lib/agent/orchestrator.ts` | Coordinate router → retrieval → builder → agent → stream | Low-Medium |

### Modified Files

| File | Change | Complexity | Risk |
|------|--------|------------|------|
| `lib/agent/graph.ts` | Add `runAgentStream()` accepting pre-built `EvidencePackage`. Remove post-hoc `getEvidence()`. | Medium | Medium |
| `lib/agent/prompts.ts` | Rewrite to static grounding rules only. Remove variable context injection. | Low | Low |
| `lib/agent/tools.ts` | Remove `search_portfolio` from default tool set. | Low | Low |
| `app/api/chat/route.ts` | Call orchestrator instead of `runAgent()`. Return SSE `ReadableStream`. | Medium | Medium |
| `lib/retrieval/index.ts` | No changes needed (reused as-is) | None | None |
| `lib/ai/provider.ts` | No changes needed | None | None |
| `lib/ai/embeddings.ts` | No changes needed | None | None |
| `lib/ai/vector-store.ts` | No changes needed | None | None |

### Frontend Files

| File | Change | Complexity |
|------|--------|------------|
| `components/Chat/ChatProvider.tsx` | Switch from `response.json()` to SSE stream consumer per streaming plan | Medium |
| `components/Chat/types.ts` | Add stream event types (`token`, `evidence`, `actions`, `done`) | Low |
| `components/Chat/SlideOutPanel.tsx` | Replace loading dots with streaming cursor; optional retrieval indicator | Low |

---

## Migration Strategy

### Phase 1 — Intent Router + Guardrails

**Goal:** Add intent classification and guardrails. Non-portfolio queries are intercepted before the agent.

**Changes:**
- Create `lib/agent/intent-router.ts`
- Update `app/api/chat/route.ts` to classify intent before calling `runAgent()`
- For `greeting`, `out_of_scope`, `ambiguous`: return response directly without agent invocation
- For `portfolio`: call existing `runAgent()` unchanged

**Risk:** Very low. Non-portfolio paths are isolated. Portfolio path is unchanged.

**Rollback:** Remove intent routing from route handler. Restore direct `runAgent()` call.

### Phase 2 — Mandatory Retrieval + Evidence Builder

**Goal:** Retrieval runs before the agent. Evidence is pre-formatted.

**Changes:**
- Create `lib/agent/evidence-builder.ts`
- In `app/api/chat/route.ts`: call `searchPortfolio()` before agent for portfolio intent
- Pass results through `buildEvidencePackage()`
- Modify `lib/agent/graph.ts` to accept `EvidencePackage` as context
- Remove post-hoc `getEvidence()` call from graph.ts

**Risk:** Medium. The agent must be tested with pre-injected context to ensure it uses evidence properly.

**Rollback:** Revert to calling `runAgent()` without pre-retrieved context.

### Phase 3 — Agent Restriction + Prompt Update

**Goal:** Agent is bounded with strict grounding rules. `search_portfolio` tool removed.

**Changes:**
- Rewrite `lib/agent/prompts.ts` — static grounding rules, no variable injection
- Update `lib/agent/tools.ts` — remove `search_portfolio` from default set
- Ensure system prompt is separated from context in message structure

**Risk:** Low. Prompt changes are textual and easily iterated.

**Rollback:** Restore previous system prompt and tool set.

### Phase 4 — Streaming Integration

**Goal:** Full SSE streaming from orchestrator to frontend.

**Changes:**
- Create `lib/agent/orchestrator.ts` as async generator
- Update `app/api/chat/route.ts` to pipe orchestrator events through SSE `ReadableStream`
- Update `components/Chat/ChatProvider.tsx` to consume SSE stream
- Handle `token`, `evidence`, `actions`, `done` events

**Risk:** Medium-High. Streaming is the most complex change. Must handle cancellation, reconnection, partial content.

**Rollback:** Route handler can toggle between streaming and JSON mode via feature flag.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Intent router misclassifies portfolio query as ambiguous | Low | Medium | Router patterns are inclusive; ambiguous falls back to helpful guidance, not refusal |
| Intent router misclassifies out-of-scope as portfolio | Low | Low | Mandatory retrieval returns empty; bounded agent says "couldn't find that information" |
| Agent ignores evidence despite grounding prompt | Low | High | Test with adversarial queries; system prompt explicitly forbids speculation |
| Evidence package truncates important content | Medium | Low | Sort by relevance; log truncation ratio |
| Streaming introduces frontend rendering jank | Medium | Low | Use throttled state updates (requestAnimationFrame) |
| Browser compatibility with ReadableStream | Low | Medium | Fall back to non-streaming JSON response for older browsers |
| Serverless function timeout (Vercel Hobby: 10s) | Medium | Medium | Long generations may hit timeout; consider Pro plan or faster model |
| Duplicate evidence from structured + semantic paths | Low | Low | Evidence Package Builder deduplicates by content hash |

---

## Validation Strategy

### Functional Validation

| Test | Expected |
|------|----------|
| Greeting "Hello" → guardrail | Returns greeting, no agent invoked |
| Out-of-scope "Solve this problem" → guardrail | Returns out-of-scope message, no agent invoked |
| Ambiguous "Can you help?" → guidance | Returns helpful guidance, no retrieval, no agent |
| Portfolio "Which projects use Python?" → retrieval + agent | Retrieval executes, agent produces grounded answer |
| No evidence found for portfolio query | Agent says "couldn't find that information" |
| Follow-up without context | Agent uses previously retrieved evidence |
| `search_portfolio` tool not available by default | Tool call fails or is not proposed by LLM |
| System prompt does not contain evidence | Inspect messages sent to LLM |

### Performance Validation

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| Non-portfolio TTFT | ~9000ms | <10ms | `performance.now()` in route handler |
| Portfolio TTFT | ~9000ms | ~1600-2700ms | `performance.mark()` before/after retrieval + first LLM token |
| Evidence builder latency | N/A | <10ms | `performance.now()` wrapper |
| Streaming overhead | N/A | <50ms | Compare streaming vs non-streaming E2E |
| Hallucination rate | Unknown | Near-zero | Manual review of 20+ test queries |

### Regression Validation

| Behavior | Must preserve |
|----------|---------------|
| Response quality | Same or better (grounded in evidence) |
| Evidence display | Identical `SearchResult[]` format |
| Navigation actions | `[openResume]`, `[openProject:slug]`, `[scrollTo:section]` still work |
| Conversation history | Last 10 messages still sent |
| Error handling | Graceful fallback on failure |
| Tool execution | `get_project_detail`, `get_resume_url`, `get_contact_info` still available |

---

## Summary

```
Before:
  agent decides everything (search, scope, refusal)
  post-hoc evidence (duplicate work)
  JSON response (no streaming)

After:
  application determines intent (pattern-based router)
  mandatory retrieval executes before agent
  evidence is formatted once and reused
  agent only synthesizes (no policy decisions)
  SSE stream delivers tokens progressively
```

The refactor shifts policy from the LLM to the application layer, making the system more predictable, testable, and factually accurate, while preserving LangGraph's reasoning capabilities for synthesis and explanation.
