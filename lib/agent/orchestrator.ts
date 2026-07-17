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
  messages: { role: string; content: string }[]
): AsyncGenerator<StreamEvent> {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const mlflow = new MLflowLogger();
  const tracer = new LangfuseTracer();

  await mlflow.startRun();
  tracer.startTrace("user-request", { messages });

  // ── Intent classification ──────────────────────────────────────────
  const intentStart = performance.now();
  const classifierResult = await classifyIntent(lastMessage);
  const intentLatency = performance.now() - intentStart;

  const intentGenId = tracer.startGeneration("intent-classification", {
    messages: classifierResult.messages,
    model: classifierResult.modelConfig.model,
    modelParameters: { temperature: classifierResult.modelConfig.temperature },
    systemPrompt: "",
  });

  tracer.endGeneration(intentGenId, {
    response: classifierResult.rawOutput,
    metadata: {
      intent: classifierResult.intent,
      latency_ms: intentLatency,
      userMessage: lastMessage,
    },
  });

  mlflow.logMetric("intent_classifier_latency_ms", intentLatency);
  mlflow.logParams(getLlmParams());

  // Guardrail intents — log what we have and return early
  switch (classifierResult.intent) {
    case "greeting":
      tracer.endTrace({ intent: classifierResult.intent, response: GUARDRAIL_GREETING });
      await mlflow.endRun("FINISHED");
      yield { type: "token", content: GUARDRAIL_GREETING };
      yield { type: "done" };
      await tracer.flushAsync();
      return;
    case "out_of_scope":
      tracer.endTrace({ intent: classifierResult.intent, response: GUARDRAIL_OUT_OF_SCOPE });
      await mlflow.endRun("FINISHED");
      yield { type: "token", content: GUARDRAIL_OUT_OF_SCOPE };
      yield { type: "done" };
      await tracer.flushAsync();
      return;
    case "ambiguous":
      tracer.endTrace({ intent: classifierResult.intent, response: GUARDRAIL_AMBIGUOUS });
      await mlflow.endRun("FINISHED");
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
    results = await searchPortfolio(lastMessage);
  } catch (error) {
    mlflow.logMetric("retrieval_latency_ms", performance.now() - retrievalStart);
    tracer.recordError(retrievalSpanId, error as Error);
    tracer.endTrace({ error: "Retrieval failed" });
    await mlflow.endRun("FAILED");
    yield {
      type: "error",
      message:
        "I'm sorry, I encountered an error searching the portfolio. Please try again.",
    };
    await tracer.flushAsync();
    return;
  }

  mlflow.logMetric("retrieval_latency_ms", performance.now() - retrievalStart);

  tracer.endSpan(retrievalSpanId, { resultCount: results.length, results });

  // ── Evidence building ──────────────────────────────────────────────
  const evidenceStart = performance.now();
  const evidenceSpanId = tracer.startSpan("evidence-builder", {
    retrievedDocumentCount: results.length,
  });
  const evidencePackage = buildEvidencePackage(results);
  mlflow.logMetric(
    "evidence_builder_latency_ms",
    performance.now() - evidenceStart,
  );

  tracer.endSpan(evidenceSpanId, evidencePackage);

  if (evidencePackage.sources.length === 0) {
    tracer.endTrace({ intent: classifierResult.intent, response: GUARDRAIL_NO_EVIDENCE });
    await mlflow.endRun("FINISHED");
    yield { type: "token", content: GUARDRAIL_NO_EVIDENCE };
    yield { type: "done" };
    await tracer.flushAsync();
    return;
  }

  // ── LLM inference ──────────────────────────────────────────────────
  const llmStart = performance.now();
  const llmParams = getLlmParams();
  const llmGenId = tracer.startGeneration("llm-generation", {
    messages: messages.slice(-10),
    model: llmParams.llm_model,
    modelParameters: { temperature: llmParams.temperature },
    systemPrompt: SYSTEM_PROMPT,
    evidence: evidencePackage.context,
  });
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

  if (llmFailed) {
    tracer.recordError(llmGenId, "LLM generation failed");
  } else {
    tracer.endGeneration(llmGenId, { response: fullText });
  }

  tracer.endTrace({
    intent: classifierResult.intent,
    response: fullText || undefined,
    evidenceCount: evidencePackage.sources.length,
  });

  await mlflow.endRun(llmFailed ? "FAILED" : "FINISHED");

  await tracer.flushAsync();

  if (llmFailed) {
    yield {
      type: "error",
      message:
        "I'm sorry, I encountered an error processing your request. Please try again.",
    };
  }
}
