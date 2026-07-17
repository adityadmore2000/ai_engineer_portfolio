import type { ObservabilityContext } from "@/lib/observability";
import { classifyIntent } from "./intent-router";
import { buildEvidencePackage } from "./evidence-builder";
import { runLLMPipeline } from "./llm-pipeline";
import { searchPortfolio } from "@/lib/retrieval";
import {
  GUARDRAIL_GREETING,
  GUARDRAIL_OUT_OF_SCOPE,
  GUARDRAIL_AMBIGUOUS,
  GUARDRAIL_NO_EVIDENCE,
  SYSTEM_PROMPT,
} from "./prompts";
import { MLflowLogger } from "./mlflow-logger";
import { LangfuseTracer } from "./langfuse-tracer";
import type { StreamEvent } from "./types";

function getLlmParams(): Record<string, string> {
  const params: Record<string, string> = {
    llm_model: process.env.CHAT_MODEL || "Qwen/Qwen3-4B-Instruct",
    temperature: "0",
  };
  return params;
}

export async function* orchestrator(
  messages: { role: string; content: string }[],
  context?: ObservabilityContext
): AsyncGenerator<StreamEvent> {
  const lastMessage = messages[messages.length - 1]?.content || "";

  const intent = await classifyIntent(lastMessage, context);

  switch (intent) {
    case "greeting":
      context?.service.updateRequest({ terminationReason: "greeting" });
      yield { type: "token", content: GUARDRAIL_GREETING };
      yield { type: "done" };
      await tracer.flushAsync();
      return;
    case "out_of_scope":
      context?.service.updateRequest({ terminationReason: "out_of_scope" });
      yield { type: "token", content: GUARDRAIL_OUT_OF_SCOPE };
      yield { type: "done" };
      await tracer.flushAsync();
      return;
    case "ambiguous":
      context?.service.updateRequest({ terminationReason: "ambiguous" });
      yield { type: "token", content: GUARDRAIL_AMBIGUOUS };
      yield { type: "done" };
      await tracer.flushAsync();
      return;
  }

  // ── Retrieval ──────────────────────────────────────────────────────
  const retrievalStart = performance.now();
  const retrievalSpanId = tracer.startSpan("retrieval", {
    query: lastMessage,
  });
  let results: Awaited<ReturnType<typeof searchPortfolio>>;
  try {
    const span = context?.service.startSpan({
      name: "retrieval",
      input: { query: lastMessage },
      metadata: { retriever: "qdrant", topK: 5 },
    });
    results = await searchPortfolio(lastMessage);
    span?.end({ output: { documentCount: results.length } });
  } catch {
    yield {
      type: "error",
      message:
        "I'm sorry, I encountered an error searching the portfolio. Please try again.",
    };
    await tracer.flushAsync();
    return;
  }

  let evidencePackage;
  {
    const span = context?.service.startSpan({
      name: "evidence-package",
      input: { chunkCount: results.length },
    });
    evidencePackage = buildEvidencePackage(results);
    span?.end({
      output: {
        sourceCount: evidencePackage.sources.length,
        contextLength: evidencePackage.context.length,
      },
    });
  }

  if (evidencePackage.sources.length === 0) {
    context?.service.updateRequest({ terminationReason: "no_evidence" });
    yield {
      type: "token",
      content: "I couldn't find that information in Aditya's portfolio.",
    };
    yield { type: "done" };
    await tracer.flushAsync();
    return;
  }

  yield* runLLMPipeline(messages, evidencePackage, context);
}
