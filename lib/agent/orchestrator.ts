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
import type { StreamEvent } from "./types";

function getLlmParams(): Record<string, string> {
  const params: Record<string, string> = {
    llm_model: process.env.CHAT_MODEL || "Qwen/Qwen3-4B-Instruct",
    temperature: "0",
  };
  return params;
}

export async function* orchestrator(
  messages: { role: string; content: string }[]
): AsyncGenerator<StreamEvent> {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const mlflow = new MLflowLogger();

  await mlflow.startRun();
  mlflow.logArtifact(lastMessage, "artifacts/input/user_input.txt");

  // ── Intent classification ──────────────────────────────────────────
  const intentStart = performance.now();
  const { intent, rawOutput } = await classifyIntent(lastMessage);
  const intentLatency = performance.now() - intentStart;

  mlflow.logMetric("intent_classifier_latency_ms", intentLatency);
  mlflow.logArtifact(
    JSON.stringify({ intent, rawOutput }, null, 2),
    "artifacts/outputs/intent_classifier.json",
  );
  mlflow.logArtifact(SYSTEM_PROMPT, "artifacts/prompts/system_prompt.txt");
  mlflow.logParams(getLlmParams());

  // Guardrail intents — log what we have and return early
  switch (intent) {
    case "greeting":
      await mlflow.endRun("FINISHED");
      yield { type: "token", content: GUARDRAIL_GREETING };
      yield { type: "done" };
      return;
    case "out_of_scope":
      await mlflow.endRun("FINISHED");
      yield { type: "token", content: GUARDRAIL_OUT_OF_SCOPE };
      yield { type: "done" };
      return;
    case "ambiguous":
      await mlflow.endRun("FINISHED");
      yield { type: "token", content: GUARDRAIL_AMBIGUOUS };
      yield { type: "done" };
      return;
  }

  // ── Retrieval ──────────────────────────────────────────────────────
  const retrievalStart = performance.now();
  let results: Awaited<ReturnType<typeof searchPortfolio>>;
  try {
    results = await searchPortfolio(lastMessage);
  } catch {
    mlflow.logMetric("retrieval_latency_ms", performance.now() - retrievalStart);
    await mlflow.endRun("FAILED");
    yield {
      type: "error",
      message:
        "I'm sorry, I encountered an error searching the portfolio. Please try again.",
    };
    return;
  }

  mlflow.logMetric("retrieval_latency_ms", performance.now() - retrievalStart);
  mlflow.logArtifact(
    JSON.stringify(results, null, 2),
    "artifacts/retrieval/retrieved_chunks.json",
  );

  // ── Evidence building ──────────────────────────────────────────────
  const evidenceStart = performance.now();
  const evidencePackage = buildEvidencePackage(results);
  mlflow.logMetric(
    "evidence_builder_latency_ms",
    performance.now() - evidenceStart,
  );
  mlflow.logArtifact(
    JSON.stringify(evidencePackage, null, 2),
    "artifacts/retrieval/evidence_package.json",
  );

  if (evidencePackage.sources.length === 0) {
    await mlflow.endRun("FINISHED");
    yield { type: "token", content: GUARDRAIL_NO_EVIDENCE };
    yield { type: "done" };
    return;
  }

  // ── LLM inference ──────────────────────────────────────────────────
  const llmStart = performance.now();
  let fullText = "";
  let llmFailed = false;

  try {
    for await (const event of runLLMPipeline(messages, evidencePackage)) {
      if (event.type === "token") {
        fullText += event.content;
      }
      yield event;
    }
  } catch {
    llmFailed = true;
  }

  mlflow.logMetric("llm_latency_ms", performance.now() - llmStart);

  if (fullText) {
    mlflow.logArtifact(fullText, "artifacts/outputs/llm_output.txt");
  }

  await mlflow.endRun(llmFailed ? "FAILED" : "FINISHED");

  if (llmFailed) {
    yield {
      type: "error",
      message:
        "I'm sorry, I encountered an error processing your request. Please try again.",
    };
  }
}
