import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  texts: z.array(z.string().max(6000)).max(120),
  locale: z.enum(["ar", "en"]),
});

export const translateContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (data.locale === "en") return {} as Record<string, string>;
    const { translateTexts } = await import("./translate.server");
    try {
      return await translateTexts(data.texts, data.locale);
    } catch {
      return {} as Record<string, string>;
    }
  });

/** Whole cached dictionary for a locale — loaded once so already-translated content renders instantly. */
export const translationDictionary = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ locale: z.enum(["ar", "en"]) }).parse(input))
  .handler(async ({ data }) => {
    if (data.locale === "en") return {} as Record<string, string>;
    const { loadDictionary } = await import("./translate.server");
    try {
      return await loadDictionary(data.locale);
    } catch {
      return {} as Record<string, string>;
    }
  });
