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
  messages: { role: string; content: string }[]
): AsyncGenerator<StreamEvent> {
  const lastMessage = messages[messages.length - 1]?.content || "";

  const intent = await classifyIntent(lastMessage);

  switch (intent) {
    case "greeting":
      yield { type: "token", content: GUARDRAIL_GREETING };
      yield { type: "done" };
      return;
    case "out_of_scope":
      yield { type: "token", content: GUARDRAIL_OUT_OF_SCOPE };
      yield { type: "done" };
      return;
    case "ambiguous":
      yield { type: "token", content: GUARDRAIL_AMBIGUOUS };
      yield { type: "done" };
      return;
  }

  let results;
  try {
    results = await searchPortfolio(lastMessage);
  } catch {
    yield {
      type: "error",
      message: "I'm sorry, I encountered an error searching the portfolio. Please try again.",
    };
    return;
  }

  const evidencePackage = buildEvidencePackage(results);

  if (evidencePackage.sources.length === 0) {
    yield {
      type: "token",
      content: "I couldn't find that information in Aditya's portfolio.",
    };
    yield { type: "done" };
    return;
  }

  yield* runLLMPipeline(messages, evidencePackage);
}
