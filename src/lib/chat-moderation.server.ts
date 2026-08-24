import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const BLOCKED = [
  "fuck", "fucking", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "whore", "slut",
  "nigger", "nigga", "faggot", "retard", "kill yourself", "kys",
  "كلب", "حيوان", "غبي", "قذر", "لعنة", "خرا", "زبالة", "حقير",
];

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

/** Fast local pass — always runs, so moderation still works when the AI is unavailable. */
export function localBadWords(body: string): boolean {
  const text = normalise(body);
  return BLOCKED.some((word) => new RegExp(`(^|\\s)${word.replace(/\s/g, "\\s+")}(\\s|$)`, "iu").test(text));
}

/** AI moderation: returns true when the message should be blocked. Never throws. */
export async function aiFlagsMessage(body: string): Promise<boolean> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return false;
  try {
    const provider = createLovableAiGatewayProvider(apiKey);
    const result = await generateText({
      model: provider("google/gemini-2.5-flash-lite"),
      messages: [{
        role: "user",
        content: `You moderate a football match chat in English and Arabic. Answer with exactly BLOCK or ALLOW. Answer BLOCK when the message contains profanity, slurs, hate, sexual content, harassment, threats or spam links — including disguised spellings. Otherwise answer ALLOW.\nMessage: ${body}`,
      }],
    });
    return /block/i.test(result.text);
  } catch {
    return false;
  }
}

export async function isMessageBlocked(body: string): Promise<boolean> {
  if (localBadWords(body)) return true;
  return aiFlagsMessage(body);
}