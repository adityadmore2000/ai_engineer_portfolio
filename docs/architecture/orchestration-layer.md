# Observability Implementation Plan

## 1. High-Level Architecture

```
route.ts
   │
   │  create ObservabilityService ──→ LangfuseObservabilityService | NoopObservabilityService
   │  service.startRequest(requestId, { messageCount })
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│                   route.ts (lifecycle owner)                 │
│  owns: request lifecycle, service creation,                  │
│        startRequest / updateRequest / endRequest / flush     │
│  imports: ObservabilityService (interface only)              │
└─────────────────────┬───────────────────────────────────────┘
                      │ context: { requestId, service }
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               lib/observability/ (provider layer)            │
│                                                              │
│  index.ts          — barrel exports                          │
│  config.ts         — env gating + typed config               │
│  types.ts          — ObservabilityService interface +        │
│                      SpanDef, GenerationDef, SpanHandle,     │
│                      GenerationHandle, ObservabilityContext  │
│  service.ts        — createObservabilityService() factory    │
│                      + misconfiguration warnings             │
│  langfuse.ts       — LangfuseObservabilityService impl       │
│                      (module-level client singleton,         │
│                       manual tracing, no callback handler)   │
│  noop.ts           — NoopObservabilityService impl           │
│                                                              │
│  ┌─ ONLY this layer knows about langfuse SDK ─────────────┐  │
│  │  Langfuse client, TraceClient, SpanClient,             │  │
│  │  GenerationClient                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ service.startSpan() / .startGeneration()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              lib/agent/ (business logic only)                │
│                                                              │
│  orchestrator.ts  — creates spans via service abstraction    │
│  intent-router.ts — creates generations via service          │
│  llm-pipeline.ts  — creates generations via service          │
│  evidence-builder — pure, unchanged                          │
│                                                              │
│  NEVER imports from Langfuse. Only imports ObservabilitySe- │
│  rvice interface from lib/observability/types.ts             │
└─────────────────────────────────────────────────────────────┘
```

Langfuse is fully confined to `lib/observability/langfuse.ts`. The agent layer only knows the `ObservabilityService` interface — never a Langfuse type.

## 2. Public Interfaces

```typescript
// lib/observability/types.ts — no Langfuse imports

export interface SpanDef {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface GenerationDef {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface SpanHandle {
  end(output?: unknown, metadata?: Record<string, unknown>): void;
}

export interface GenerationHandle {
  end(output?: unknown, metadata?: Record<string, unknown>): void;
}

export interface ObservabilityService {
  startRequest(requestId: string, metadata?: Record<string, unknown>): void;
  updateRequest(metadata: Record<string, unknown>): void;
  endRequest(): void;
  startSpan(def: SpanDef): SpanHandle;
  startGeneration(def: GenerationDef): GenerationHandle;
  flush(): Promise<void>;
}

export interface ObservabilityContext {
  requestId: string;
  service: ObservabilityService;
}
```

**Key design decisions:**

- `startRequest` / `updateRequest` / `endRequest` / `flush` are only called by `route.ts`. `startSpan` / `startGeneration` are called by the pipeline.
- `updateRequest()` sets mid-request metadata like `terminationReason` for early exits.
- `endRequest()` is called after the orchestrator completes, before flush — records final status.
- The `ObservabilityContext` only carries `requestId` and the `service` — no Langfuse types.
- No LangChain callback handler or `getLangChainCallbacks()` method. All tracing is manual via `startSpan()` / `startGeneration()`.
- `SpanHandle.end()` and `GenerationHandle.end()` auto-compute duration from creation time.

## 3. Module / Class Diagram

```
lib/observability/
│
├── types.ts
│   └── exports: ObservabilityService (interface)
│               ObservabilityContext (interface)
│               SpanDef, GenerationDef, SpanHandle, GenerationHandle
│
├── config.ts
│   └── exports: observabilityConfig(), LangfuseConfig
│
├── service.ts
│   └── exports: createObservabilityService() → ObservabilityService
│       └── warns on partial misconfiguration (one key set without other)
│
├── langfuse.ts
│   ├── module-level: getClient() → Langfuse | null (singleton)
│   ├── class LangfuseObservabilityService implements ObservabilityService
│   │   ├── ready(): boolean
│   │   ├── startRequest() → trace = client.trace({ id, name, metadata })
│   │   ├── updateRequest() → trace.update(metadata)
│   │   ├── endRequest() → trace.update({ metadata: { status: "success" } })
│   │   ├── startSpan() → LangfuseSpanHandleImpl
│   │   ├── startGeneration() → LangfuseGenerationHandleImpl
│   │   └── flush() → client.flushAsync() with 2s timeout
│   ├── class LangfuseSpanHandleImpl implements SpanHandle
│   │   └── end() → span.end({ output, metadata: { ...metadata, durationMs } })
│   └── class LangfuseGenerationHandleImpl implements GenerationHandle
│       └── end() → extracts promptTokens/completionTokens/totalTokens
│                      → generation.end({ output, usage: { input, output, total, unit: "TOKENS" } })
│                      (usage block only included when tokens are present)
│
└── noop.ts
    └── class NoopObservabilityService implements ObservabilityService
        └── all methods no-ops
        └── const noopHandle (shared singleton)
```

## 4. Generation / Span Ownership

| Component | Owns |
|---|---|
| `route.ts` | `startRequest()` / `updateRequest()` / `endRequest()` / `flush()` |
| `intent-router.ts` | `startGeneration("intent-classification")` / `end()` |
| `orchestrator.ts` | `startSpan("retrieval")` / `end()` and `startSpan("evidence-package")` / `end()` |
| `llm-pipeline.ts` | `startGeneration("chat-generation")` / `end()` |

## 5. Files to Add / Modify

### New files — `lib/observability/`

| File | Exports |
|---|---|
| `index.ts` | `createObservabilityService()`, `ObservabilityService`, `ObservabilityContext`, types |
| `config.ts` | `observabilityConfig()` returning `{ langfuse: { enabled, publicKey, secretKey, baseUrl } }` |
| `types.ts` | All interfaces and types |
| `service.ts` | `createObservabilityService()` factory |
| `langfuse.ts` | `LangfuseObservabilityService`, handle impls |
| `noop.ts` | `NoopObservabilityService`, shared `noopHandle` |

### Modified files

| File | Change |
|---|---|
| `app/api/chat/route.ts` | Create service, call `startRequest`, pass `context` to orchestrator, call `endRequest()` and `flush()` in `finally` |
| `lib/agent/orchestrator.ts` | Accept optional `ObservabilityContext`. Call `service.startSpan` around retrieval and evidence. Call `service.updateRequest` for guardrail/no-evidence. |
| `lib/agent/intent-router.ts` | Accept optional `ObservabilityContext`. Owns `startGeneration("intent-classification")` / `end()`. Captures token counts from response. |
| `lib/agent/llm-pipeline.ts` | Accept optional `ObservabilityContext`. Owns `startGeneration("chat-generation")` / `end()`. Captures token counts from final stream chunk. |
| `lib/agent/prompts.ts` | No changes |
| `lib/ai/provider.ts` | No changes — no callback handler to thread through |
| `package.json` | Add `langfuse` |

## 6. Responsibilities Summary

| Layer | Owns | Does NOT own |
|---|---|---|
| `route.ts` | Request lifecycle: create service, `startRequest`, `updateRequest`, `endRequest`, `flush` | Span/generation lifecycle, Langfuse internals |
| `lib/observability/` | Provider implementation, trace/span/generation management, error handling | Request parsing, business logic |
| `lib/agent/` | Business logic only — records events through abstraction | Langfuse internals, trace/request lifecycle |

## 7. Request Lifecycle

```
POST /api/chat  ──►  route.ts
   │
   │  1. parse messages
   │  2. service = createObservabilityService()
   │     service.startRequest(requestId, { messageCount: N })
   │     context = { requestId, service }
   │
   │  3. yield* orchestrator(messages, context)
   │
   ├──── orchestrator calls classifyIntent(message, context)
   │       [intent-router.ts owns this generation]
   │     gen = service.startGeneration({
   │       name: "intent-classification",
   │       input: [{ role: "user", content: prompt }],
   │       metadata: { model: intentModelName, temperature: 0 }
   │     })
   │     response = await llm.invoke(prompt)
   │     gen.end({
   │       output: rawResponse,
   │       metadata: {
   │         intent: "portfolio" | "greeting" | "out_of_scope" | "ambiguous",
   │         model: intentModelName,
   │         temperature: 0,
   │         promptTokens: response.usage_metadata?.input_tokens,
   │         completionTokens: response.usage_metadata?.output_tokens,
   │         totalTokens: response.usage_metadata?.total_tokens,
   │       }
   │     })
   │     return intent
   │
   │   [orchestrator handles guardrail]
   │   if intent is greeting/out_of_scope/ambiguous:
   │     service.updateRequest({ terminationReason: intent })
   │     yield guardrail response + done
   │     return ◄── generator ends, back to route.ts
   │
   ├──── orchestrator calls searchPortfolio(query)
   │     [orchestrator owns this span]
   │     span = service.startSpan({
   │       name: "retrieval",
   │       input: { query },
   │       metadata: { retriever: "qdrant", topK: 5 }
   │     })
   │     results = await searchPortfolio(query)
   │     span.end({ output: { documentCount: results.length } })
   │
   ├──── orchestrator calls buildEvidencePackage(results)
   │     [orchestrator owns this span]
   │     span = service.startSpan({
   │       name: "evidence-package",
   │       input: { chunkCount: results.length },
   │     })
   │     evidence = buildEvidencePackage(results)
   │     span.end({
   │       output: {
   │         sourceCount: evidence.sources.length,
   │         contextLength: evidence.context.length,
   │       }
   │     })
   │
   │   [orchestrator handles no-evidence]
   │   if evidence.sources.length === 0:
   │     service.updateRequest({ terminationReason: "no_evidence" })
   │     yield no-evidence response + done
   │     return ◄── generator ends, back to route.ts
   │
   ├──── orchestrator calls runLLMPipeline(messages, evidence, context)
   │       [llm-pipeline.ts owns this generation]
   │     gen = service.startGeneration({
   │       name: "chat-generation",
   │       input: llmMessages,
   │       metadata: { model: chatModelName, temperature: 0, streamEnabled: true }
   │     })
   │     stream = await llm.stream(llmMessages)
   │     for await (chunk of stream) {
   │       if (chunk.usage_metadata) finalUsage = chunk.usage_metadata
   │       yield { type: "token", content: token }
   │     }
   │     gen.end({
   │       output: fullText,
   │       metadata: {
   │         model: chatModelName, temperature: 0, streamEnabled: true,
   │         promptTokens: finalUsage?.input_tokens,
   │         completionTokens: finalUsage?.output_tokens,
   │         totalTokens: finalUsage?.total_tokens,
   │       }
   │     })
   │
   │  4. yield { type: "evidence" }, { type: "actions" }, { type: "done" }
   │
   │  5. route.ts finally (inside ReadableStream.start):
   │       controller.close()
   │       service.endRequest()
   │       await service.flush()    ← 2s timeout, errors swallowed
   │
   ▼
```

### Early-exit example (greeting)

```
service.startRequest(id, { messageCount: 1 })
yield* orchestrator(messages, { requestId, service })
  classifyIntent(message, { requestId, service })
    gen: intent-classification, end()
    intent === "greeting"
  service.updateRequest({ terminationReason: "greeting" })
  yield guardrail response + done
  return
service.endRequest()    ← sets metadata.status: "success"
await service.flush()   ← trace sent with 1 generation + terminationReason
```

## 8. Sequence Diagram

```
route.ts              ObservabilityService       orchestrator.ts        intent-router      retrieval       evidence-builder   llm-pipeline
   │                          │                       │                      │                  │                │                  │
   │──createService()────────►│                       │                      │                  │                │                  │
   │──startRequest()─────────►│                       │                      │                  │                │                  │
   │                          │ (trace created)       │                      │                  │                │                  │
   │──orchestrator()─────────│──────────────────────►│                      │                  │                │                  │
   │                          │                       │──startGeneration()──►│                  │                │                  │
   │                          │◄────gen handle────────│                      │                  │                │                  │
   │                          │◄──classifyIntent()───│─────────────────────►│                  │                │                  │
   │                          │◄────gen.end()────────│                      │                  │                │                  │
   │                          │                       │◄────intent──────────│                  │                │                  │
   │                          │                       │ [guardrail?]        │                  │                │                  │
   │                          │◄──updateRequest()────│ (if guardrail)      │                  │                │                  │
   │                          │                       │──startSpan()────────│─────────────────►│                │                  │
   │                          │◄────span handle──────│                      │                  │                │                  │
   │                          │◄──searchPortfolio()─│──────────────────────│─────────────────►│                │                  │
   │                          │◄────span.end()──────│                      │                  │                │                  │
   │                          │                       │──startSpan()────────│────────────────────────────────►│                  │
   │                          │◄────span handle──────│                      │                  │                │                  │
   │                          │◄──buildEvidence()───│──────────────────────│────────────────────────────────►│                  │
   │                          │◄────span.end()──────│                      │                  │                │                  │
   │                          │                       │──startGeneration()─│──────────────────────────────────────────────────►│
   │                          │◄────gen handle──────│                      │                  │                │                  │
   │                          │◄──runLLMPipeline()─│──────────────────────│──────────────────────────────────────────────────►│
   │◄────yield StreamEvents──│──────────────────────│                      │                  │                │                  │
   │                          │◄────gen.end()──────│                      │                  │                │                  │
   │                          │                       │                      │                  │                │                  │
   │──endRequest()───────────►│                       │                      │                  │                │                  │
   │──flush()────────────────►│                       │                      │                  │                │                  │
   │                          │ (events sent)         │                      │                  │                │                  │
```

## 9. Langfuse Implementation Details

### `LangfuseObservabilityService` — self-contained with module-level client

```typescript
// Module-level singleton — reused across requests
let client: Langfuse | null = null;

function getClient(): Langfuse | null {
  if (client) return client;
  const config = observabilityConfig();
  if (!config.langfuse.enabled) return null;
  try {
    client = new Langfuse({
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      baseUrl: config.langfuse.baseUrl,
    });
    return client;
  } catch (e) {
    console.warn("[Observability] Langfuse init failed:", e);
    return null;
  }
}
```

### Interface implementation

| Method | Implementation |
|---|---|
| `startRequest(id, metadata)` | `this.trace = client.trace({ id, name: "chat-request", metadata })` |
| `updateRequest(metadata)` | `this.trace?.update(metadata)` |
| `endRequest()` | `this.trace?.update({ metadata: { status: "success" } })` |
| `startSpan(def)` | `const span = this.trace!.span(def)` → returns `LangfuseSpanHandleImpl(span)` |
| `startGeneration(def)` | `const gen = this.trace!.generation(def)` → returns `LangfuseGenerationHandleImpl(gen)` |
| `flush()` | `Promise.race([client.flushAsync(), timeout(2000)])` |

### Handles

```typescript
class LangfuseSpanHandleImpl implements SpanHandle {
  private startTime = performance.now();

  constructor(private span: LangfuseSpanClient) {}

  end(output?: unknown, metadata?: Record<string, unknown>): void {
    try {
      const durationMs = performance.now() - this.startTime;
      this.span.end({
        output,
        metadata: { ...metadata, durationMs },
      });
    } catch (e) {
      console.warn("[Observability] span.end failed:", e);
    }
  }
}

class LangfuseGenerationHandleImpl implements GenerationHandle {
  private startTime = performance.now();

  constructor(private generation: LangfuseGenerationClient) {}

  end(output?: unknown, metadata?: Record<string, unknown>): void {
    try {
      const durationMs = performance.now() - this.startTime;
      const { promptTokens, completionTokens, totalTokens, ...rest } =
        (metadata || {}) as Record<string, unknown>;
      const usage: Record<string, unknown> = {};
      if (typeof promptTokens === "number") usage.input = promptTokens;
      if (typeof completionTokens === "number") usage.output = completionTokens;
      if (typeof totalTokens === "number") usage.total = totalTokens;
      if (Object.keys(usage).length > 0) usage.unit = "TOKENS";

      this.generation.end({
        output,
        ...rest,
        ...(Object.keys(usage).length > 0 ? { usage } : {}),
        metadata: { ...(rest.metadata as Record<string, unknown> | undefined), durationMs },
      });
    } catch (e) {
      console.warn("[Observability] generation.end failed:", e);
    }
  }
}
```

### Error handling — internalized

Every method wraps provider calls in try/catch. On failure, `this.enabled` is set to `false` and all subsequent calls become no-ops. The application never catches observability exceptions.

```typescript
startRequest(id: string, metadata?: Record<string, unknown>): void {
  if (!this.enabled) return;
  try {
    const c = getClient();
    if (!c) { this.enabled = false; return; }
    this.trace = c.trace({ id, name: "chat-request", metadata });
  } catch (e) {
    console.warn("[Observability] startRequest failed:", e);
    this.enabled = false;
  }
}
```

## 10. Span / Generation Contents

### Trace (request-level)

| Field | Source |
|---|---|
| name | `"chat-request"` |
| id | UUID |
| metadata.messageCount | from `route.ts` |
| metadata.terminationReason | set by `updateRequest` — `"greeting"` / `"out_of_scope"` / `"ambiguous"` / `"no_evidence"` / undefined |
| metadata.status | set by `endRequest` — `"success"` |

### Generation: intent-classification

| Field | Source |
|---|---|
| input | `[{ role: "user", content: classificationPrompt }]` |
| output | Raw LLM text response |
| metadata.intent | `"portfolio"` / `"greeting"` / `"out_of_scope"` / `"ambiguous"` |
| metadata.model | `INTENT_MODEL` env var |
| metadata.temperature | `0` |
| metadata.promptTokens | `response.usage_metadata?.input_tokens` (provider-dependent, may be absent) |
| metadata.completionTokens | `response.usage_metadata?.output_tokens` (provider-dependent) |
| metadata.totalTokens | `response.usage_metadata?.total_tokens` (provider-dependent) |
| usage.durationMs | auto-calculated by handle |

### Span: retrieval

| Field | Source |
|---|---|
| input.query | User message |
| metadata.retriever | `"qdrant"` |
| metadata.topK | `5` |
| output.documentCount | `results.length` |
| metadata.durationMs | auto-calculated by handle |

### Span: evidence-package

| Field | Source |
|---|---|
| input.chunkCount | Raw result count before dedup |
| output.sourceCount | `evidence.sources.length` |
| output.contextLength | `evidence.context.length` in chars |
| metadata.durationMs | auto-calculated by handle |

### Generation: chat-generation

| Field | Source |
|---|---|
| input | Full messages sent to LLM (system prompt + evidence + history) |
| output | `fullText` (assistant response) |
| metadata.model | `CHAT_MODEL` env var |
| metadata.temperature | `0` |
| metadata.streamEnabled | `true` |
| metadata.promptTokens | `finalChunk?.usage_metadata?.input_tokens` (provider-dependent) |
| metadata.completionTokens | `finalChunk?.usage_metadata?.output_tokens` (provider-dependent) |
| metadata.totalTokens | `finalChunk?.usage_metadata?.total_tokens` (provider-dependent) |
| usage.durationMs | auto-calculated by handle |

## 11. Error-Handling Strategy

| Scenario | Behavior |
|---|---|
| Langfuse init fails (bad keys, network) | `getClient()` returns null. All methods no-op. `ready()` returns false. |
| Langfuse down mid-request | try/catch in handle `end()` catches, logs warning. Service stays enabled. |
| `flush()` times out (2s) | Promise.race rejects, caught, logged. Response already streamed. |
| Observability disabled (no env vars) | `createObservabilityService()` returns `NoopObservabilityService`. Zero overhead. |
| Partial env vars (one of two set) | Factory logs warning, returns `NoopObservabilityService`. |
| Exception in pipeline code | Route's `finally` still calls `endRequest()` and `flush()` — whatever was recorded is sent. |

The **application never catches observability exceptions**. The service handles all of them internally.

## 12. Flush Safety

```typescript
async flush(): Promise<void> {
  if (!this.enabled) return;
  try {
    const c = getClient();
    if (!c) return;
    await Promise.race([
      c.flushAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("flush timeout")), 2000)
      ),
    ]);
  } catch (e) {
    console.warn("[Observability] flush failed:", e);
  }
}
```

Route's `finally` block calls `flush()` before the response completes. If flush takes longer than 2s, it times out and the response is unaffected.

## 13. Recommended Improvements / Future Scope

**1. Separate the Python agent observability**
The Python publishing agent (`agent/publish_agent.py`) is a separate LangGraph REPL. Should get its own Langfuse integration later using the `langfuse` Python SDK.

**2. AsyncLocalStorage refactor**
If Edge runtime compatibility is not required, the `ObservabilityContext` can be propagated via `AsyncLocalStorage` instead of explicit parameter passing. This would reduce the diff surface area in pipeline files.

**3. Sampling for Langfuse traces**
Add a `LANGFUSE_SAMPLE_RATE` env var (0.0–1.0) to probabilistically skip tracing.

**4. MLflow for experiment tracking (future scope)**
A separate `MlflowObservabilityService` implementing the same `ObservabilityService` interface can be added alongside Langfuse.

**5. OpenTelemetry as a unified alternative**
Langfuse can ingest OTel traces natively. The `ObservabilityService` interface can have an OTel implementation.

**6. LangChain auto-instrumentation via callback handler (future scope)**
If more complex LangChain chains are introduced, the `ObservabilityService` interface could be extended with `getLangChainCallbacks()` to provide a `BaseCallbackHandler[]`. The current approach uses only manual tracing, which is simpler and sufficient for the current pipeline.

## 14. Implementation Phases (Completed)

### Phase 1: Foundation
- Added `langfuse` to `package.json`
- Created `config.ts` with env var reading and feature gating
- Created `types.ts` with all interfaces
- Created `noop.ts` with `NoopObservabilityService`
- Created barrel export in `index.ts`

### Phase 2: Langfuse implementation
- Implemented `LangfuseObservabilityService` with all interface methods
- Implemented `LangfuseSpanHandleImpl` and `LangfuseGenerationHandleImpl`
- Implemented `createObservabilityService()` factory in `service.ts`
- Added flush timeout protection (2s)
- Added misconfiguration warnings for partial env vars

### Phase 3: Wire into pipeline
- Threaded `ObservabilityContext` through orchestrator → pipeline stages
- Added `service.startSpan()` / `startGeneration()` calls at each stage
- Captured token counts from LLM responses and stream chunks
- Wired creation, lifecycle methods, and flushing in `route.ts`

### Phase 4: Edge cases & hardening
- Guardrail short-circuits flush partial traces with `terminationReason`
- No-evidence case recorded with retrieval + evidence spans
- Langfuse flush timeout (2s) prevents hanging
- Console warnings for misconfigured env vars

---

## Summary of Key Design Decisions

| Decision | Rationale |
|---|---|
| `ObservabilityService` interface | Agent pipeline is provider-agnostic; Langfuse is swappable |
| Service internalizes error handling | Application never catches observability exceptions |
| Manual tracing only (no callback handler) | Langfuse LangChain handler is incompatible with manual trace approach in v5; manual tracing gives full control over contents |
| Token counts are optional telemetry | Provider-dependent; not estimated when absent |
| Module-level Langfuse client singleton | Reused across requests within the same Node.js process |
| `getIntentModel()` stays in intent-router.ts | No architectural benefit to moving it |
| Flush with 2s timeout | Prevents langfuse from hanging the response |
| `ObservabilityContext` as simple carrier | Only `requestId` + `service` — no provider-specific types leaked |
