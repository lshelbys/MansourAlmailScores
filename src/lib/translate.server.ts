import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type TranslationMap = Record<string, string>;

const MAX_ITEMS = 120;
const MAX_CHARS = 6000;

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Translation service returned an invalid payload.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function translateTexts(texts: string[], locale: string): Promise<TranslationMap> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= MAX_CHARS))].slice(0, MAX_ITEMS);
  if (unique.length === 0) return {};

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: TranslationMap = {};

  const { data: cached } = await supabaseAdmin
    .from("translations")
    .select("source_text,translated_text")
    .eq("locale", locale)
    .in("source_text", unique);
  for (const row of cached ?? []) out[row.source_text] = row.translated_text;

  const missing = unique.filter((t) => !out[t]);
  if (missing.length === 0) return out;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return out;

  const provider = createLovableAiGatewayProvider(apiKey);
  const payload = Object.fromEntries(missing.map((text, index) => [String(index), text]));
  const { text } = await generateText({
    model: provider("openai/gpt-5.6-sol"),
    providerOptions: { lovable: { reasoningEffort: "none" } },
    prompt:
      `Translate the values of this JSON object into ${locale === "ar" ? "Modern Standard Arabic" : locale}. ` +
      "This is football (soccer) editorial content: keep club, competition and player names in their commonly used local form, keep Markdown structure, numbers and scores intact, and never add commentary. " +
      "Return JSON only, with exactly the same keys and translated string values.\n\n" +
      JSON.stringify(payload),
  });

  const parsed = extractJson(text) as Record<string, unknown>;
  const inserts: { locale: string; source_text: string; translated_text: string }[] = [];
  missing.forEach((source, index) => {
    const value = parsed[String(index)];
    if (typeof value !== "string" || !value.trim()) return;
    out[source] = value;
    inserts.push({ locale, source_text: source, translated_text: value });
  });

  if (inserts.length > 0) await supabaseAdmin.from("translations").insert(inserts);
  return out;
}

/** Every cached translation for a locale (used to prewarm the client on language switch). */
export async function loadDictionary(locale: string): Promise<TranslationMap> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: TranslationMap = {};
  const pageSize = 1000;
  for (let page = 0; page < 20; page += 1) {
    const { data } = await supabaseAdmin
      .from("translations")
      .select("source_text,translated_text")
      .eq("locale", locale)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    for (const row of data ?? []) out[row.source_text] = row.translated_text;
    if (!data || data.length < pageSize) break;
  }
  return out;
}
