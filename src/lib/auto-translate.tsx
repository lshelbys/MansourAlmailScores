import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateContent, translationDictionary } from "./translate.functions";
import { useI18n } from "./i18n";
import { formatDate, formatDob, formatKickoff } from "./db";
import { UI_AR } from "./ui-phrases";

type Tx = <T extends string | null | undefined>(value: T) => T;

const Ctx = createContext<{
  tx: Tx;
  num: (v: number | string | null | undefined) => string;
  reverse: (v: string) => string[];
  ready: boolean;
}>({
  tx: ((v: unknown) => v) as Tx,
  num: (v) => (v == null ? "" : String(v)),
  reverse: () => [],
  ready: true,
});

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const CACHE_KEY = "mas.translations.ar";

/** Arabic mode shows Arabic-Indic numerals everywhere, including inside translated text. */
export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]!);
}

const AR_DIACRITICS = /[\u064B-\u0652\u0640]/g;

/** Loose Arabic normalisation so "العربي" matches "العربى" and friends. */
function normalizeAr(value: string): string {
  return value
    .replace(AR_DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Site-wide machine translation for admin-authored content (club names, competitions,
 * players, venues, news…). Fixed UI phrases resolve instantly from a built-in dictionary,
 * previously translated content comes from a cache preloaded on language switch, and only
 * genuinely new strings hit the AI translator.
 */
export function AutoTranslateProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const translate = useServerFn(translateContent);
  const loadDictionary = useServerFn(translationDictionary);
  const [map, setMap] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(true);
  const asked = useRef(new Set<string>());
  const queue = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(0);

  useEffect(() => {
    asked.current = new Set();
    queue.current = new Set();
    if (lang !== "ar") { setMap({}); setReady(true); return; }
    setReady(false);
    let alive = true;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
      setMap(cached);
    } catch { setMap({}); }
    // Prewarm the full server-side dictionary once so nothing waits on the AI translator.
    void loadDictionary({ data: { locale: "ar" } })
      .then((dict) => { if (alive && dict && Object.keys(dict).length > 0) setMap((prev) => ({ ...dict, ...prev })); })
      .catch(() => undefined)
      .finally(() => { if (alive && queue.current.size === 0 && inflight.current === 0) setReady(true); });
    return () => { alive = false; };
  }, [lang, loadDictionary]);

  useEffect(() => {
    if (lang !== "ar" || Object.keys(map).length === 0) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* cache is optional */ }
  }, [lang, map]);

  const flush = useCallback(async () => {
    timer.current = null;
    const batch = [...queue.current].slice(0, 100);
    if (batch.length === 0) return;
    batch.forEach((item) => queue.current.delete(item));
    inflight.current += 1;
    try {
      const result = await translate({ data: { texts: batch, locale: "ar" } });
      if (result && Object.keys(result).length > 0) setMap((prev) => ({ ...prev, ...result }));
    } catch {
      batch.forEach((item) => asked.current.delete(item));
    } finally {
      inflight.current -= 1;
      if (queue.current.size === 0 && inflight.current === 0) setReady(true);
    }
    // Keep several batches in flight so long pages translate in parallel, not one after another.
    if (queue.current.size > 0 && inflight.current < 4) void flush();
  }, [translate]);

  const request = useCallback((value: string) => {
    if (lang !== "ar") return;
    const key = value.trim();
    if (!key || key.length > 6000 || asked.current.has(key)) return;
    setReady(false);
    asked.current.add(key);
    queue.current.add(key);
    if (!timer.current) timer.current = setTimeout(() => { void flush(); }, 20);
  }, [flush, lang]);

  const tx = useCallback(<T extends string | null | undefined>(value: T): T => {
    if (lang === "en" || !value || typeof value !== "string") return value;
    if (!/[A-Za-z]/.test(value)) return toArabicDigits(value) as T;
    const key = value.trim();
    const instant = UI_AR[key];
    if (instant) return instant as T;
    const cached = map[key];
    if (cached) return toArabicDigits(cached) as T;
    request(value);
    return value;
  }, [lang, map, request]) as Tx;

  const num = useCallback(
    (value: number | string | null | undefined) => {
      if (value == null) return "";
      const raw = String(value);
      return lang === "ar" ? toArabicDigits(raw) : raw;
    },
    [lang],
  );

  /** Arabic query -> the original English strings it was translated from (for search). */
  const reverse = useCallback(
    (value: string) => {
      const needle = normalizeAr(value);
      if (!needle || needle.length < 2) return [];
      const out = new Set<string>();
      const collect = (source: string, translated: string) => {
        if (out.size >= 12) return;
        if (normalizeAr(translated).includes(needle)) out.add(source);
      };
      for (const [source, translated] of Object.entries(UI_AR)) collect(source, translated);
      for (const [source, translated] of Object.entries(map)) collect(source, translated);
      return [...out];
    },
    [map],
  );

  return <Ctx.Provider value={{ tx, num, reverse, ready }}>{children}</Ctx.Provider>;
}

export function useTranslationReady() {
  return useContext(Ctx).ready;
}

/** Map an Arabic search term back to the English source terms stored in the database. */
export function useReverseTranslate() {
  return useContext(Ctx).reverse;
}

/** Translate any admin-authored string into the active language. */
export function useTx(): Tx {
  return useContext(Ctx).tx;
}

/** Localize any number (scores, minutes, percentages) for the active language. */
export function useNum() {
  return useContext(Ctx).num;
}

/** Locale-aware date formatting bound to the active language. */
export function useDates() {
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  return {
    locale,
    kickoff: (iso: string | null | undefined) => formatKickoff(iso, locale),
    dob: (iso: string | null | undefined) => formatDob(iso, locale),
    date: (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => formatDate(iso, locale, opts),
  };
}

/** Backwards-compatible helper: translate a fixed list of strings. */
export function useAutoTranslate(texts: (string | null | undefined)[]): Tx {
  const tx = useTx();
  texts.forEach((item) => { if (item) tx(item); });
  return tx;
}
