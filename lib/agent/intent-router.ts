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
): Promise<ClassifierResult> {
  const trimmed = message.trim().toLowerCase();

  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: "greeting",
        rawOutput: trimmed,
        messages: [{ role: "user", content: trimmed }],
        modelConfig: { model: "rule-based", temperature: 0 },
      };
    }
  }

  const llm = getIntentModel();
  const prompt = CLASSIFICATION_PROMPT.replace("{message}", message.trim());
  const messages: { role: string; content: string }[] = [
    { role: "user", content: prompt },
  ];
  const model = process.env.CHAT_MODEL || "Qwen/Qwen3-4B-Instruct";

  try {
    const response = await llm.invoke(messages);

    const raw =
      typeof response === "string"
        ? response
        : typeof response?.content === "string"
          ? response.content
          : "";

    const label = raw.trim().toLowerCase();
    const matched = VALID_INTENTS.find((i) => label.includes(i));
    return {
      intent: matched ?? "ambiguous",
      rawOutput: raw.trim(),
      messages,
      modelConfig: { model, temperature: 0 },
    };
  } catch (err) {
    return {
      intent: "ambiguous",
      rawOutput: err instanceof Error ? err.message : String(err),
      messages,
      modelConfig: { model, temperature: 0 },
    };
  }
}
