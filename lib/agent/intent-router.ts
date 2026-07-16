import { getIntentModel } from "@/lib/ai";

export type Intent = "portfolio" | "greeting" | "out_of_scope" | "ambiguous";

const VALID_INTENTS: Intent[] = [
  "portfolio",
  "greeting",
  "out_of_scope",
  "ambiguous",
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|greetings|good morning|good evening)\b/i,
  /^(how are you|how's it going|what's up|nice to meet you)\b/i,
];

const CLASSIFICATION_PROMPT = `Classify the following user message into exactly one of these categories.

Categories:
- portfolio: The user is asking about someone's projects, skills, experience, resume, contact info, technologies used, or work history.
- greeting: The user is saying hello, being polite, or making casual conversation.
- out_of_scope: The user is asking about something unrelated to a personal portfolio — general knowledge, programming, weather, news, jokes, math problems, etc.
- ambiguous: The user's intent is unclear, too vague, or could be interpreted multiple ways.

Message: {message}

Category:`;

export type ClassifierResult = {
  intent: Intent;
  rawOutput: string;
};

export async function classifyIntent(
  message: string,
): Promise<ClassifierResult> {
  const trimmed = message.trim().toLowerCase();

  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "greeting", rawOutput: trimmed };
    }
  }

  const llm = getIntentModel();
  const prompt = CLASSIFICATION_PROMPT.replace("{message}", message.trim());

  try {
    const response = await llm.invoke([
      { role: "user", content: prompt },
    ]);

    const raw =
      typeof response === "string"
        ? response
        : typeof response?.content === "string"
          ? response.content
          : "";

    const label = raw.trim().toLowerCase();
    const matched = VALID_INTENTS.find((i) => label.includes(i));
    return { intent: matched ?? "ambiguous", rawOutput: raw.trim() };
  } catch {
    return { intent: "ambiguous", rawOutput: "" };
  }
}
