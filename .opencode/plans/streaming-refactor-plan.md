# Portfolio Assistant — Architecture Specification

## Direct LLM Pipeline: Retrieval-First Streaming Architecture

---

## Table of Contents

1. [Introduction](#introduction)
2. [Design Principles](#design-principles)
3. [System Architecture](#system-architecture)
4. [Component Specifications](#component-specifications)
   - 4.1 Intent Router
   - 4.2 Guardrail Responses
   - 4.3 Mandatory Retrieval
   - 4.4 Evidence Package Builder
   - 4.5 Direct LLM Pipeline
   - 4.6 Streaming Transport
   - 4.7 Orchestrator
5. [Data Flow](#data-flow)
6. [Message Structure](#message-structure)
7. [SSE Event Protocol](#sse-event-protocol)
8. [File Layout](#file-layout)
9. [Current vs Target Architecture](#current-vs-target-architecture)
10. [Migration Strategy](#migration-strategy)
11. [Risk Analysis](#risk-analysis)
12. [Validation Strategy](#validation-strategy)

---

## Introduction

The portfolio assistant is a chatbot embedded in a personal portfolio website. It answers questions about an individual's projects, skills, experience, resume, and contact information.

The assistant is **not** a general-purpose chatbot. Its domain is strictly bounded to portfolio content. Every answer must be grounded in retrieved evidence. The system enforces this constraint at the application layer — not through LLM prompts or agent autonomy.

The architecture follows a **retrieval-first pipeline**:

1. Classify the user's intent
2. If portfolio-related, retrieve relevant evidence
3. Format the evidence into a structured context
4. Stream a grounded answer from the LLM

There is no agent loop, no tool selection, and no autonomy over search or refusal. Policy decisions belong to the application. Synthesis belongs to the LLM.

---

## Design Principles

**1. Application owns policy.**

The application decides whether a query is in scope, whether retrieval executes, and what evidence reaches the LLM. The LLM never decides to search, refuse, or answer from training data.

**2. Retrieval is mandatory for every portfolio question.**

The LLM never generates a portfolio answer without evidence. If retrieval returns no results, the system says so explicitly.

**3. Simplicity over orchestration.**

A single streaming LLM call with pre-loaded evidence replaces agent loops, tool routing, and graph state management. Fewer moving parts means fewer failure modes.

**4. LLM-based intent classification.**

A lightweight local LLM classifies user intent. Regex is used only for trivial greeting detection. This eliminates keyword-maintenance burden and handles paraphrasing robustly.

**5. Streaming is the only delivery mechanism.**

Tokens arrive at the client progressively. The first token reaches the user as soon as the LLM begins generating. No JSON response buffering.

**6. Each component has one responsibility.**

Intent routing, retrieval, evidence formatting, LLM generation, and streaming transport each own exactly one concern. They communicate through typed interfaces. They are independently testable.

---

## System Architecture

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
Mandatory Retrieval     Guardrail Response
        │
        ▼
 Evidence Package Builder
        │
        ▼
 Direct LLM Pipeline
        │
        ▼
  SSE Stream
        │
        ▼
   Frontend
```

The architecture is a linear pipeline with a single branching point at the intent router. Every stage produces a deterministic output consumed by the next stage.

---

## Component Specifications

### 4.1 Intent Router

**File:** `lib/agent/intent-router.ts`

**Responsibility:** Classify the last user message into one of four intent categories before any retrieval or LLM generation occurs.

**Interface:**

```typescript
type Intent = "portfolio" | "greeting" | "out_of_scope" | "ambiguous";

function classifyIntent(message: string): Promise<Intent>;
```

**Classification strategy — two layers:**

**Layer 1 (fast path — regex matching):**

Clear greetings are identified immediately via pattern matching:

```
^(hi|hello|hey|greetings|good morning|good evening)\b
^(how are you|how's it going|what's up|nice to meet you)\b
```

Messages matching these patterns are classified as `greeting` in under 1ms without an LLM call.

**Layer 2 (lightweight LLM classification):**

All messages that do not match a greeting pattern are classified by a small local LLM. The model runs on the same Ollama instance that serves the main chat model.

**Classification prompt:**

```
Classify the following user message into exactly one of these categories.

Categories:
- portfolio: The user is asking about someone's projects, skills, experience,
  resume, contact information, technologies used, or work history.
- greeting: The user is saying hello, being polite, or making casual conversation.
- out_of_scope: The user is asking about something unrelated to a personal
  portfolio — general knowledge, programming, weather, news, jokes, math
  problems, or other unrelated topics.
- ambiguous: The user's intent is unclear, too vague, or could be interpreted
  multiple ways.

Message: {user message}
Category:
```

The model produces a single token: `portfolio`, `greeting`, `out_of_scope`, or `ambiguous`. Expected latency is 50-200ms.

**Model:** `qwen2.5:1.5b` (or equivalent) running on the local Ollama instance.

**Failure handling:** Any unexpected output from the classifier (empty response, unrecognized token) defaults to `ambiguous` — the safest fallback.

**Routing decisions:**

| Intent | System action |
|--------|---------------|
| `portfolio` | Proceed to mandatory retrieval |
| `greeting` | Return a greeting response immediately |
| `out_of_scope` | Return a guardrail response immediately |
| `ambiguous` | Return a guidance response immediately |

---

### 4.2 Guardrail Responses

**File:** `lib/agent/prompts.ts` (guardrail constants)

**Responsibility:** Provide human-readable responses for non-portfolio intents without invoking retrieval or the LLM.

**Response by intent:**

| Intent | Response |
|--------|----------|
| `greeting` | "Hi! I'm Aditya More's portfolio assistant. I can help you learn about his projects, skills, experience, and more. What would you like to know?" |
| `out_of_scope` | "I can only answer questions about Aditya More's portfolio — his projects, skills, experience, and contact information. Would you like to ask about any of those topics?" |
| `ambiguous` | "I'd be happy to help with questions about Aditya's projects, skills, experience, or portfolio. What would you like to know?" |

These responses are returned directly through the streaming transport as a single token event followed by a done event. No retrieval or LLM generation occurs.

---

### 4.3 Mandatory Retrieval

**File:** `lib/retrieval/index.ts`

**Responsibility:** Retrieve relevant portfolio content for every `portfolio`-classified query. This stage always executes before the LLM generates any response.

**Retrieval pipeline:**

```
Structured Search (pattern matching → Sanity GROQ)
       │
       ▼
Semantic Search (fallback — Qdrant vector search)
       │
       ▼
SearchResult[]
```

**Structured search** attempts to match the query against known patterns:

- Technology lookup: "Which projects use Docker?" → `searchByTechnology("Docker")` → Sanity GROQ
- Contact lookup: "What's your email?" → `getContactInfo()` → Sanity GROQ
- Resume lookup: "Open your resume" → `getResumeUrl()` → Sanity GROQ
- Experience lookup: "Where have you worked?" → `getExperience()` → Sanity GROQ
- Skills lookup: "What technologies do you know?" → `getSkills()` → Sanity GROQ
- Project lookup: "Tell me about the OCR project" → `getProjectBySlugFromSanity()` → Sanity GROQ

**Semantic search** executes only when no structured pattern matches. It:

1. Creates a vector store connection to Qdrant
2. Generates a query embedding via Ollama (`nomic-embed-text`)
3. Retrieves the top 5 most similar document chunks

**Output:** `SearchResult[]` — an array of result objects with `content`, `projectTitle`, `slug`, `section`, `url`, and optional `score` fields.

**Behavior when empty:** If retrieval returns zero results (no structured match and no semantic match), the evidence package builder creates an empty package, and the LLM pipeline produces: "I couldn't find that information in Aditya's portfolio."

---

### 4.4 Evidence Package Builder

**File:** `lib/agent/evidence-builder.ts`

**Responsibility:** Transform raw `SearchResult[]` objects into a formatted, token-budgeted context string and a deduplicated source list.

**Interface:**

```typescript
type EvidencePackage = {
  context: string;          // Formatted markdown string for LLM consumption
  sources: SearchResult[];  // Deduplicated, relevance-ordered sources for frontend
  truncated: boolean;       // Whether the context was truncated to fit token budget
};

function buildEvidencePackage(results: SearchResult[]): EvidencePackage;
```

**Processing steps:**

1. **Deduplicate:** Merge entries with identical content. When structured and semantic search return overlapping results, only one copy is kept.

2. **Order by relevance:** Semantic results are ordered by similarity score descending. Structured results are ordered by specificity (project-specific results before general results).

3. **Format as readable context:** Convert each result into a structured markdown block:

```
Project: {projectTitle}
Section: {section}
Content: {content}
```

4. **Truncate to token budget:** If the formatted context exceeds the budget (default 2000 characters), entries at the end of the ordered list are dropped. The `truncated` flag is set to `true`.

5. **Preserve sources:** The deduplicated, ordered `SearchResult[]` array is preserved separately for frontend citation display — truncation affects the LLM context but not the source list.

**Example formatted context:**

```
Retrieved Portfolio Information:

Project: Warehouse Parcel Monitoring System
Section: Problem Statement
Content: The warehouse faced challenges with manual parcel tracking, leading to lost packages and inefficient routing.

Project: Warehouse Parcel Monitoring System
Section: Technologies
Content: Python, YOLOX, OpenCV, Docker, PostgreSQL, Redis
```

**Rationale for separating context from sources:**

- The LLM receives a clean, human-readable text block optimized for its context window
- The frontend receives the raw metadata (projectTitle, slug, section, url) needed to render hyperlinked citations
- Truncation affects only the LLM — the frontend always receives the complete deduplicated source list

---

### 4.5 Direct LLM Pipeline

**File:** `lib/agent/llm-pipeline.ts`

**Responsibility:** Generate a grounded answer by streaming a single LLM call with pre-loaded evidence. No agent, no tools, no ReAct loop.

**Interface:**

```typescript
async function* runLLMPipeline(
  messages: { role: string; content: string }[],
  evidencePackage: EvidencePackage
): AsyncGenerator<StreamEvent>;
```

**Inputs:**

| Parameter | Source | Description |
|-----------|--------|-------------|
| `messages` | Request body | Full conversation history from the frontend |
| `evidencePackage` | Evidence Package Builder | Formatted evidence context + source list |

**Output:** An async generator that yields `StreamEvent` objects.

**Internal flow:**

1. **Build message array:**

```
[
  { role: "system", content: SYSTEM_PROMPT },
  { role: "system", content: "Retrieved Portfolio Information:\n{evidencePackage.context}" },
  ...previousMessages.slice(-10),
  { role: "user", content: latestQuestion }
]
```

The evidence context is injected as a separate `system` message between the static system prompt and the conversation history. This keeps the system prompt cacheable while clearly delineating evidence from instructions.

2. **Stream LLM generation:**

```typescript
const llm = getChatModel();
const stream = await llm.stream(llmMessages);

for await (const chunk of stream) {
  const token = chunk.content as string;
  if (token) {
    fullText += token;
    yield { type: "token", content: token };
  }
}
```

3. **Extract navigation actions** after generation completes. The full response text is scanned for action markers:

| Marker | Action | Example |
|--------|--------|---------|
| `[openResume]` | Open resume in new tab | `[openResume]` |
| `[openProject:slug]` | Navigate to project page | `[openProject:video-captioning-agent]` |
| `[scrollTo:section]` | Scroll to homepage section | `[scrollTo:experience]` |
| `[navigate:url]` | Open external URL | `[navigate:https://...]` |

4. **Emit evidence and actions:**

```typescript
yield { type: "evidence", data: evidencePackage.sources };
yield { type: "actions", data: extractedActions };
yield { type: "done" };
```

---

### 4.6 Streaming Transport

**File:** `app/api/chat/route.ts`

**Responsibility:** Deliver each `StreamEvent` from the orchestrator to the frontend as an SSE (Server-Sent Events) stream.

**HTTP response format:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Each event is encoded as:

```
event: {type}
data: {json}
\n\n
```

Non-streaming responses (greeting, out-of-scope, ambiguous) use the same SSE format. They emit a single `token` event and a `done` event.

**ReadableStream implementation:**

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    try {
      for await (const event of orchestrateChat(messages)) {
        const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
        if (event.type === "done") break;
        if (event.type === "error") break;
      }
    } catch (error) {
      const errEvent = `event: error\ndata: ${JSON.stringify({ type: "error", message: "Internal error" })}\n\n`;
      controller.enqueue(encoder.encode(errEvent));
    } finally {
      controller.close();
    }
  }
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  },
});
```

**Cancellation:** The `request.signal` (`AbortSignal`) is checked after each stream chunk. If the client disconnects, the stream terminates and cleanup runs.

---

### 4.7 Orchestrator

**File:** `lib/agent/orchestrator.ts`

**Responsibility:** Sequence the stages of the pipeline. It owns no business logic.

**Interface:**

```typescript
async function* orchestrateChat(
  messages: { role: string; content: string }[]
): AsyncGenerator<StreamEvent>;
```

**Flow:**

```
classifyIntent(lastMessage)
       │
       ├── "greeting"     → yield token(guardrail), done
       ├── "out_of_scope" → yield token(guardrail), done
       ├── "ambiguous"    → yield token(guardrail), done
       └── "portfolio"    → continue
                │
                ▼
     searchPortfolio(query)
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

**Constraints:**

- The orchestrator does not contain intent classification logic (delegated to Intent Router)
- The orchestrator does not contain retrieval logic (delegated to `searchPortfolio`)
- The orchestrator does not contain formatting logic (delegated to Evidence Package Builder)
- The orchestrator does not contain LLM invocation logic (delegated to LLM Pipeline)

Each component is independently replaceable and independently testable.

---

## Data Flow

```
                   ┌──────────────────┐
                   │  HTTP Request     │
                   │  POST /api/chat   │
                   │  { messages }     │
                   └────────┬─────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │  Intent Router    │
                   │                   │
                   │  Input: message   │
                   │  Output: Intent   │
                   └────────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       ┌────────────┐ ┌──────────┐ ┌───────────┐
       │ portfolio  │ │ greeting │ │ out_of_   │
       │            │ │          │ │ scope /   │
       │            │ │          │ │ ambiguous │
       └─────┬──────┘ └────┬─────┘ └─────┬─────┘
             │             │             │
             ▼             │             │
   ┌──────────────────┐    │             │
   │  searchPortfolio │    │             │
   │  (structured →   │    │             │
   │   semantic)      │    │             │
   │                  │    │             │
   │  Output:         │    │             │
   │  SearchResult[]  │    │             │
   └────────┬─────────┘    │             │
            │              │             │
            ▼              │             │
   ┌──────────────────┐    │             │
   │  Evidence Builder │    │             │
   │                   │    │             │
   │  Input:           │    │             │
   │  SearchResult[]   │    │             │
   │                   │    │             │
   │  Output:          │    │             │
   │  EvidencePackage  │    │             │
   └────────┬─────────┘    │             │
            │              │             │
            ▼              │             │
   ┌──────────────────┐    │             │
   │  LLM Pipeline     │    │             │
   │                   │    │             │
   │  Input:           │    │             │
   │  messages +       │    │             │
   │  EvidencePackage  │    │             │
   │                   │    │             │
   │  Output:          │    │             │
   │  StreamEvent[]    │    │             │
   └────────┬─────────┘    │             │
            │              │             │
            ▼              ▼             ▼
   ┌─────────────────────────────────────────┐
   │           SSE ReadableStream             │
   │                                          │
   │  Events: token, evidence, actions, done  │
   └────────────────┬────────────────────────┘
                    │
                    ▼
           HTTP Response (text/event-stream)
                    │
                    ▼
           Frontend fetch reader
                    │
                    ▼
           React state (incremental)
                    │
                    ▼
             ChatMessage render
```

---

## Message Structure

The LLM receives three categories of messages in every portfolio request:

**1. System prompt (static, identical per request):**

```
Role: grounded portfolio assistant
Rules: must use evidence, must not speculate
Format: conversational markdown, action markers when appropriate
```

**2. Evidence context (dynamic, varies per query):**

```
Retrieved Portfolio Information:
Project: ... Section: ... Content: ...
```

**3. Conversation history + question:**

```
Previous assistant/user messages (last 10)
Latest user question
```

The ordering within the message array is:

| Index | Role | Content | Source |
|-------|------|---------|--------|
| 0 | `system` | Static grounding rules | `prompts.ts` |
| 1 | `system` | Retrieved evidence context | `EvidencePackage.context` |
| 2..N-1 | `user`/`assistant` | Conversation history | Request body (last 10 messages) |
| N | `user` | Latest user question | Request body (last message) |

---

## SSE Event Protocol

The frontend receives a stream of typed events. Each event is a line-based SSE message.

**Event types:**

```
event: token
data: {"type":"token","content":"Here"}

event: token
data: {"type":"token","content":"'s"}

event: token
data: {"type":"token","content":" what I found..."}
```

```
event: evidence
data: {"type":"evidence","data":[{"content":"...","projectTitle":"Warehouse Monitoring","section":"Approach"}]}
```

```
event: actions
data: {"type":"actions","data":[{"type":"openProject","payload":"video-captioning-agent"}]}
```

```
event: error
data: {"type":"error","message":"An internal error occurred."}
```

```
event: done
data: {"type":"done"}
```

**Client-side parsing:**

The frontend reads `response.body` via a `ReadableStream` + `TextDecoder` reader. Incoming bytes are accumulated into a buffer. Complete SSE messages are split on `\n\n` boundaries, parsed, and dispatched by event type.

**Non-streaming responses** (greeting, out-of-scope, ambiguous) use the same event format:

```
event: token\ndata: {"type":"token","content":"Hi! I'm the portfolio assistant..."}\n\nevent: evidence\ndata: {"type":"evidence","data":[]}\n\nevent: actions\ndata: {"type":"actions","data":[]}\n\nevent: done\ndata: {"type":"done"}\n\n
```

---

## File Layout

### New Files

| File | Responsibility |
|------|---------------|
| `lib/agent/intent-router.ts` | Intent classification via lightweight LLM |
| `lib/agent/evidence-builder.ts` | Transform `SearchResult[]` into `EvidencePackage` |
| `lib/agent/llm-pipeline.ts` | Single `ChatOllama.stream()` call with evidence context |
| `lib/agent/orchestrator.ts` | Coordinate pipeline stages as async generator |

### Modified Files

| File | Change |
|------|--------|
| `lib/agent/prompts.ts` | Rewrite to static grounding rules only (no evidence injection) |
| `app/api/chat/route.ts` | Return SSE `ReadableStream` via orchestrator instead of JSON response |
| `components/Chat/ChatProvider.tsx` | Consume SSE stream instead of `response.json()` |
| `components/Chat/types.ts` | Add `StreamEvent` types for SSE protocol |
| `components/Chat/SlideOutPanel.tsx` | Replace loading dots with streaming cursor |

### Removed Files

| File | Reason |
|------|--------|
| `lib/agent/graph.ts` | LangGraph agent not needed (replaced by LLM pipeline) |
| `lib/agent/tools.ts` | No tool definitions needed (retrieval happens before LLM) |
| `lib/agent/types.ts` | Agent-specific types not needed (replaced by stream events) |

### Unchanged Files

| File | Reason |
|------|--------|
| `lib/retrieval/index.ts` | `searchPortfolio()` reused as-is |
| `lib/retrieval/structured.ts` | GROQ queries unchanged |
| `lib/retrieval/semantic.ts` | Qdrant search unchanged |
| `lib/ai/provider.ts` | `getChatModel()` unchanged |
| `lib/ai/embeddings.ts` | Embedding model unchanged |
| `lib/ai/vector-store.ts` | Vector store unchanged |
| `sanity/*` | Sanity client and queries unchanged |
| `components/Chat/ChatMessage.tsx` | Markdown rendering unchanged |
| `components/Chat/ChatInput.tsx` | Input component unchanged |
| `components/Chat/ExamplePrompts.tsx` | Example prompts unchanged |

---

## Current vs Target Architecture

### Current

```
User → POST /api/chat
         → runAgent(messages)
              → getChatModel()
              → createReactAgent({ llm, tools, systemPrompt })
              → agent.invoke()   ← ReAct loop (autonomous search, tool calls)
              → getEvidence()    ← duplicate retrieval after generation
              → NextResponse.json({ content, evidence, actions })
```

The current architecture uses a LangGraph `createReactAgent` that autonomously decides whether to search the portfolio, which tools to call, and when to generate an answer. A separate `getEvidence()` call runs duplicate retrieval after the agent completes. The entire response is returned as a single JSON payload.

### Target

```
User → POST /api/chat (SSE transport)
         → orchestrateChat(messages)
              → classifyIntent()
              → [guardrail] or [searchPortfolio() → buildEvidencePackage() → runLLMPipeline()]
              → SSE stream (token, evidence, actions, done)
```

The target architecture removes agent autonomy entirely. Intent is classified at the application layer. Retrieval is mandatory and happens before any LLM generation. Evidence is formatted once and reused. The LLM receives a grounded context and streams its answer token by token.

---

## Migration Strategy

### Phase 1 — Intent Router + Guardrails

**Goal:** Add intent classification. Non-portfolio queries are intercepted before reaching the agent.

**Changes:**
- Create `lib/agent/intent-router.ts`
- Update `app/api/chat/route.ts` to classify intent before calling `runAgent()`
- For `greeting`, `out_of_scope`, `ambiguous`: return guardrail response immediately
- For `portfolio`: delegate to existing `runAgent()` unchanged

**Risk:** Very low. Non-portfolio paths are isolated. The portfolio path is untouched.

**Rollback:** Remove intent routing from the route handler. Restore direct `runAgent()` call.

### Phase 2 — Mandatory Retrieval + Evidence Builder

**Goal:** Retrieval executes before the agent. Evidence is formatted into a structured package.

**Changes:**
- Create `lib/agent/evidence-builder.ts`
- In the route handler: call `searchPortfolio()` before the agent for portfolio intents
- Pass results through `buildEvidencePackage()`
- Inject formatted evidence as additional context to the existing agent
- Remove post-hoc `getEvidence()` call

**Risk:** Low-Medium. The agent receives new context it did not have before. Test that the agent uses the pre-supplied evidence rather than ignoring it.

**Rollback:** Revert to calling `runAgent()` without pre-retrieved context.

### Phase 3 — Direct LLM Pipeline

**Goal:** Remove the LangGraph agent. Replace with the direct LLM pipeline.

**Changes:**
- Create `lib/agent/llm-pipeline.ts`
- Delete `lib/agent/graph.ts`, `lib/agent/tools.ts`, `lib/agent/types.ts`
- Update the route handler to call `runLLMPipeline()` instead of `runAgent()`
- Rewrite `lib/agent/prompts.ts` to static grounding rules only

**Risk:** Medium. This is the core architectural change. Validate against the full query set to ensure response quality is preserved or improved.

**Rollback:** Restore the deleted files and revert the route handler to call `runAgent()`.

### Phase 4 — Streaming Integration

**Goal:** Deliver all responses via SSE streaming.

**Changes:**
- Create `lib/agent/orchestrator.ts` as async generator
- Update the route handler to pipe orchestrator events through a `ReadableStream`
- Update the frontend to consume the SSE stream
- Handle `token`, `evidence`, `actions`, `done`, and `error` events

**Risk:** Medium-High. Streaming adds concerns around cancellation, partial responses, and browser compatibility.

**Rollback:** Toggle between streaming and JSON response mode via environment variable or feature flag.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Intent classifier misclassifies portfolio query as ambiguous | Low | Medium | The ambiguous response guides the user toward rephrasing rather than refusing |
| Intent classifier misclassifies out-of-scope query as portfolio | Low | Low | Mandatory retrieval returns empty; the LLM says "couldn't find that information" |
| Intent classifier adds latency to every request | Medium | Low | 50-200ms; only portfolio requests pay this cost (non-portfolio paths return guardrails immediately) |
| LLM ignores evidence despite grounding prompt | Low | High | System prompt explicitly prohibits speculation; validate with adversarial test cases |
| Evidence package truncates critical content | Medium | Low | Sort by relevance score; increase token budget if needed; log truncation events |
| Streaming causes excessive React re-renders | Medium | Low | Throttle state updates via requestAnimationFrame; accumulate tokens between frames |
| Client-side SSE parsing splits events across buffer boundaries | Medium | Low | Implement a line-buffer parser that accumulates chunks and splits on `\n\n` delimiters |
| No tools available for follow-up clarification | Low | Low | Follow-up questions are answered from evidence already in the conversation context |

---

## Validation Strategy

### Functional Validation

| Test | Expected |
|------|----------|
| "Hello" → guardrail | Greeting response returned, no retrieval or LLM invocation |
| "Solve this math problem" → guardrail | Out-of-scope response returned |
| "Can you help me?" → guardrail | Ambiguous guidance response returned |
| "Which projects use Docker?" → portfolio | Retrieval executes, LLM generates grounded answer listing matching projects |
| "Tell me about the OCR project" → portfolio | Retrieval fetches project, LLM summarizes from evidence |
| Query with no matching evidence | LLM responds "I couldn't find that information" |
| Multi-turn: "Which projects use Python?" then "Tell me more about the first one" | Second turn uses context from conversation history |
| Navigation actions in response | `[openResume]`, `[openProject:slug]` parsed and emitted as actions |
| Empty messages array | HTTP 400 validation error |
| Streaming arrives progressively | Client receives tokens before generation completes |
| Client disconnects mid-stream | Server terminates generation, no resource leak |

### Performance Validation

| Metric | Method | Target |
|--------|--------|--------|
| Greeting TTFT | `performance.now()` at first SSE event | <5ms |
| Out-of-scope TTFT | `performance.now()` at first SSE event | ~50-200ms |
| Ambiguous TTFT | `performance.now()` at first SSE event | ~50-200ms |
| Portfolio TTFT | Time from request to first `token` SSE event | ~1600-2700ms |
| Evidence builder latency | `performance.now()` around `buildEvidencePackage()` | <10ms |
| Streaming throughput | Tokens delivered to client per second | Match LLM generation rate (~37 tok/s) |
| Streaming overhead | Difference between streaming and non-streaming E2E time | <50ms |

### Instrumentation

The route handler records performance marks at each pipeline stage:

```
chat-request
intent-classified
retrieval-complete
evidence-built
first-token-emitted
stream-complete
```

These are logged to `console.log` in development and can be forwarded to a structured logging system in production.

### Browser Compatibility

| Feature | Minimum Chrome | Minimum Firefox | Minimum Safari | Minimum Edge |
|---------|---------------|----------------|----------------|--------------|
| `ReadableStream` | 43 | 65 | 10.1 | 79 |
| `TextDecoder` | 38 | 19 | 10.1 | 38 |
| `fetch` streaming body | 43 | 65 | 10.1 | 79 |
| `AbortController` | 66 | 57 | 12.1 | 16 |

All features are available in the browser versions that Next.js 15 supports.
