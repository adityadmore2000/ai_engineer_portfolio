import type { ObservabilityContext } from "@/lib/observability";
import { getIntentModel } from "@/lib/ai";

export type Intent = "portfolio" | "greeting" | "out_of_scope" | "ambiguous";

const VALID_INTENTS: Intent[] = [
  "portfolio",
  "greeting",
  "out_of_scope",
  "ambiguous",
];

export const CLASSIFICATION_PROMPT = `Classify the following user message into exactly one of these categories.

Categories:
- portfolio: The user is asking about someone's projects, skills, experience, resume, contact info, technologies used, or work history.
- greeting: The user is saying hello, being polite, or making casual conversation.
- out_of_scope: The user is asking about something unrelated to a personal portfolio — general knowledge, programming, weather, news, jokes, math problems, etc.
- ambiguous: The user's intent is unclear, too vague, or could be interpreted multiple ways.

Message: {message}

Category:`;

const GREETING_PATTERNS = [
  /^(hi|hello|hey|greetings|good morning|good evening)\b/i,
  /^(how are you|how's it going|what's up|nice to meet you)\b/i,
];

export type ClassifierResult = {
  intent: Intent;
  rawOutput: string;
  messages: { role: string; content: string }[];
  modelConfig: { model: string; temperature: number };
};

export async function classifyIntent(
  message: string,
  context?: ObservabilityContext
): Promise<Intent> {
  const trimmed = message.trim().toLowerCase();

  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "greeting";
    }
  }

  const llm = getIntentModel();
  const prompt = CLASSIFICATION_PROMPT.replace("{message}", message.trim());

  const gen = context?.service.startGeneration({
    name: "intent-classification",
    input: [{ role: "user", content: prompt }],
    metadata: {
      model: process.env.INTENT_MODEL || "qwen2.5:1.5b",
      temperature: 0,
    },
  });

  try {
    const response = await llm.invoke([
      { role: "user", content: prompt },
    ]);

    const raw = (typeof response.content === "string" ? response.content : "").trim().toLowerCase();

    const matched = VALID_INTENTS.find((i) => raw.includes(i));
    const intent = matched ?? "ambiguous";

    const usage = (response as { usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }).usage_metadata;

    gen?.end({
      output: raw,
      metadata: {
        intent,
        model: process.env.INTENT_MODEL || "qwen2.5:1.5b",
        temperature: 0,
        promptTokens: usage?.input_tokens,
        completionTokens: usage?.output_tokens,
        totalTokens: usage?.total_tokens,
      },
    });

    return intent;
  } catch {
    gen?.end({ output: "error", metadata: { intent: "ambiguous", error: true } });
    return "ambiguous";
  }
}
