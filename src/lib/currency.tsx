import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const CURRENCIES = ["EUR", "USD", "GBP", "KWD", "SAR", "AED", "EGP"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Indicative conversion rates from euros. Admin always enters values in euros. */
const RATES: Record<Currency, number> = { EUR: 1, USD: 1.08, GBP: 0.85, KWD: 0.33, SAR: 4.05, AED: 3.97, EGP: 52 };
const SYMBOLS: Record<Currency, string> = { EUR: "€", USD: "$", GBP: "£", KWD: "KD ", SAR: "SR ", AED: "AED ", EGP: "E£" };

/** Parses an admin-entered euro value such as "€12m", "12.5 m", "900k", "€1,200,000". */
export function parseEuroValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = /(-?[\d.,]+)\s*([mkb])?/i.exec(raw.replace(/\s/g, ""));
  if (!match?.[1]) return null;
  const n = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return n * 1_000;
  if (suffix === "m") return n * 1_000_000;
  if (suffix === "b") return n * 1_000_000_000;
  return n;
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2).replace(/\.0+$/, "")}bn`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Converts a euro-denominated admin value into the viewer's chosen currency. */
export function formatMoney(euroText: string | null | undefined, currency: Currency): string {
  const euros = parseEuroValue(euroText);
  if (euros == null) return euroText?.trim() || "—";
  return `${SYMBOLS[currency]}${compact(euros * RATES[currency])}`;
}

type Ctx = { currency: Currency; setCurrency: (c: Currency) => void };
const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "EUR";
    const stored = localStorage.getItem("mas.currency") as Currency | null;
    return stored && CURRENCIES.includes(stored) ? stored : "EUR";
  });
  useEffect(() => {
    try { localStorage.setItem("mas.currency", currency); } catch { /* ignore */ }
  }, [currency]);
  const value = useMemo(() => ({ currency, setCurrency: setCurrencyState }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  return useContext(CurrencyContext) ?? { currency: "EUR", setCurrency: () => {} };
}
