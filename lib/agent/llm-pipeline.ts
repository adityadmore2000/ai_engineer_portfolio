import { getChatModel } from "@/lib/ai";
import type { ObservabilityContext } from "@/lib/observability";
import { SYSTEM_PROMPT } from "./prompts";
import type { EvidencePackage, StreamEvent, AgentAction } from "./types";

function extractActions(text: string): AgentAction[] {
  const actions: AgentAction[] = [];

  const openResumeMatch = text.match(/\[openResume\]/i);
  if (openResumeMatch) {
    actions.push({ type: "openResume", payload: "" });
  }

  for (const match of text.matchAll(/\[openProject:([^\]]+)\]/g)) {
    actions.push({ type: "openProject", payload: match[1].trim() });
  }

  for (const match of text.matchAll(/\[scrollTo:([^\]]+)\]/g)) {
    actions.push({ type: "scrollTo", payload: match[1].trim() });
  }

  for (const match of text.matchAll(/\[navigate:([^\]]+)\]/g)) {
    actions.push({ type: "navigate", payload: match[1].trim() });
  }

  return actions;
}

export async function* runLLMPipeline(
  messages: { role: string; content: string }[],
  evidencePackage: EvidencePackage,
  context?: ObservabilityContext
): AsyncGenerator<StreamEvent> {
  const llm = getChatModel();

  const llmMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "system" as const,
      content: `Retrieved Portfolio Information:\n${evidencePackage.context}`,
    },
    ...messages.slice(-10).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
  ];

  const gen = context?.service.startGeneration({
    name: "chat-generation",
    input: llmMessages,
    metadata: {
      model: process.env.CHAT_MODEL || "qwen3:8b",
      temperature: 0,
      streamEnabled: true,
    },
  });

  let fullText = "";
  let finalUsage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;

  try {
    const stream = await llm.stream(llmMessages);

    for await (const chunk of stream) {
      const chunkWithUsage = chunk as { usage_metadata?: typeof finalUsage };
      if (chunkWithUsage.usage_metadata) {
        finalUsage = chunkWithUsage.usage_metadata;
      }
      const token =
        typeof chunk === "string"
          ? chunk
          : typeof chunk?.content === "string"
            ? chunk.content
            : "";
      if (token) {
        fullText += token;
        yield { type: "token", content: token } as StreamEvent;
      }
    }
  } catch {
    gen?.end({
      output: "",
      metadata: { error: true },
    });
    yield {
      type: "error",
      message: "I'm sorry, I encountered an error processing your request. Please try again.",
    };
    return;
  }

  if (!fullText.trim()) {
    yield { type: "token", content: "I couldn't find that information in Aditya's portfolio." };
  }

  gen?.end({
    output: fullText,
    metadata: {
      model: process.env.CHAT_MODEL || "qwen3:8b",
      temperature: 0,
      streamEnabled: true,
      promptTokens: finalUsage?.input_tokens,
      completionTokens: finalUsage?.output_tokens,
      totalTokens: finalUsage?.total_tokens,
    },
  });

  const actions = extractActions(fullText);
  yield { type: "evidence", data: evidencePackage.sources };
  yield { type: "actions", data: actions };
  yield { type: "done" };
}
