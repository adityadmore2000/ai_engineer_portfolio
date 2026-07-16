import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getChatModel } from "@/lib/ai";
import { tools } from "./tools";
import { SYSTEM_PROMPT } from "./prompts";
import type { AgentOutput, AgentAction } from "./types";
import type { SearchResult } from "@/lib/retrieval";

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

async function getEvidence(query: string): Promise<SearchResult[]> {
  try {
    const { searchPortfolio } = await import("@/lib/retrieval");
    return await searchPortfolio(query);
  } catch {
    return [];
  }
}

export async function runAgent(
  messages: { role: string; content: string }[]
): Promise<AgentOutput> {
  const llm = getChatModel();
  const lastMessage = messages[messages.length - 1]?.content || "";

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: `You are a helpful portfolio assistant for Aditya More — an Applied AI Engineer.\n\n${SYSTEM_PROMPT}`,
  });

  const result = await agent.invoke({
    messages: messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  });

  const lastMsg = result.messages[result.messages.length - 1];
  const text = typeof lastMsg?.content === "string" ? lastMsg.content : "";

  const evidence = await getEvidence(lastMessage);
  const actions = extractActions(text);

  const cleaned = text
    .replace(/\[openResume\]/gi, "")
    .replace(/\[openProject:[^\]]+\]/gi, "")
    .replace(/\[scrollTo:[^\]]+\]/gi, "")
    .replace(/\[navigate:[^\]]+\]/gi, "")
    .trim();

  return {
    content: cleaned || "I'm not sure how to respond to that.",
    evidence,
    actions,
  };
}
