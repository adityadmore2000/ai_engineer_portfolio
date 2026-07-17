import type { ObservabilityContext } from "@/lib/observability";
import { classifyIntent } from "./intent-router";
import { buildEvidencePackage } from "./evidence-builder";
import { runLLMPipeline } from "./llm-pipeline";
import { searchPortfolio } from "@/lib/retrieval";
import {
  GUARDRAIL_GREETING,
  GUARDRAIL_OUT_OF_SCOPE,
  GUARDRAIL_AMBIGUOUS,
} from "./prompts";
import type { StreamEvent } from "./types";

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
      return;
    case "out_of_scope":
      context?.service.updateRequest({ terminationReason: "out_of_scope" });
      yield { type: "token", content: GUARDRAIL_OUT_OF_SCOPE };
      yield { type: "done" };
      return;
    case "ambiguous":
      context?.service.updateRequest({ terminationReason: "ambiguous" });
      yield { type: "token", content: GUARDRAIL_AMBIGUOUS };
      yield { type: "done" };
      return;
  }

  let results;
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
      message: "I'm sorry, I encountered an error searching the portfolio. Please try again.",
    };
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
    return;
  }

  yield* runLLMPipeline(messages, evidencePackage, context);
}
