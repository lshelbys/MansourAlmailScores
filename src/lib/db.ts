import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];
export type Lineup = Database["public"]["Tables"]["match_lineups"]["Row"];
export type StandingRow = Database["public"]["Tables"]["standings_rows"]["Row"];
export type NewsPost = Database["public"]["Tables"]["news_posts"]["Row"];
export type Coach = Database["public"]["Tables"]["coaches"]["Row"];
export type Transfer = Database["public"]["Tables"]["transfers"]["Row"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type StandingLabel = Database["public"]["Tables"]["standing_labels"]["Row"];

export const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const;

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function formatHeight(cm: number | null | undefined, unit: "cm" | "ft"): string {
  if (!cm) return "—";
  if (unit === "cm") return `${cm} cm`;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

/** Live match clock in seconds, derived from the stored timer state. */
export function matchClockSeconds(m: Pick<Match, "timer_elapsed_seconds" | "timer_running" | "timer_started_at">, nowMs = Date.now()): number {
  const base = m.timer_elapsed_seconds ?? 0;
  if (!m.timer_running || !m.timer_started_at) return base;
  return base + Math.max(0, Math.floor((nowMs - new Date(m.timer_started_at).getTime()) / 1000));
}

export function formatClock(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ht: "Half-time",
  ft: "Full-time",
  aet: "After extra time",
  pen: "After penalties",
  postponed: "Postponed",
  cancelled: "Cancelled",
  awarded: "Awarded",
  interrupted: "Interrupted",
};

export function formatKickoff(iso: string | null | undefined, locale?: string): string {
  if (!iso) return locale?.startsWith("ar") ? "لم يُحدد" : "TBD";
  const d = new Date(iso);
  return d.toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

/** Shared event presentation so admin and public views always agree. */
export const EVENT_META: Record<string, { label: string; icon: string }> = {
  goal: { label: "Goal", icon: "⚽" },
  penalty_goal: { label: "Penalty goal", icon: "🥅" },
  penalty: { label: "Penalty goal", icon: "🥅" },
  penalty_miss: { label: "Penalty missed", icon: "❌" },
  missed_penalty: { label: "Penalty missed", icon: "❌" },
  own_goal: { label: "Own goal", icon: "🔴" },
  yellow: { label: "Yellow card", icon: "🟨" },
  second_yellow: { label: "Second yellow", icon: "🟨🟥" },
  red: { label: "Red card", icon: "🟥" },
  substitution: { label: "Substitution", icon: "🔁" },
  sub: { label: "Substitution", icon: "🔁" },
  var: { label: "VAR", icon: "📺" },
  assist: { label: "Assist", icon: "👟" },
  note: { label: "Note", icon: "📝" },
};

export function eventIcon(type: string): string {
  return EVENT_META[type]?.icon ?? "•";
}

export function eventLabel(type: string): string {
  return EVENT_META[type]?.label ?? type;
}

/** Tailwind classes for a 0–10 player rating chip. */
export function ratingClass(rating: number): string {
  if (rating >= 8) return "bg-success text-success-foreground";
  if (rating >= 7) return "bg-primary text-primary-foreground";
  if (rating >= 6) return "bg-warning text-warning-foreground";
  return "bg-destructive text-destructive-foreground";
}

/** Locale-aware calendar date, used for transfers, news and founding dates. */
export function formatDate(iso: string | null | undefined, locale?: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, opts);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `x-${Date.now()}`;
}

/** Season label for a date, e.g. 2026-08-10 -> "26/27" (seasons start in July). */
export function seasonOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y % 100).padStart(2, "0")}/${String((y + 1) % 100).padStart(2, "0")}`;
}

export function currentSeason(): string {
  return seasonOf(new Date());
}

/** Inclusive ISO date bounds for a season label like "26/27". */
export function seasonRange(label: string): { from: string; to: string } {
  const start = 2000 + Number(label.slice(0, 2));
  return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
}

export function formatDob(dob: string | null | undefined, locale?: string): string {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/** "Round 1" from a numeric round, falling back to any free-text round. */
export function roundLabel(round_number: number | null | undefined, round?: string | null): string | null {
  if (round_number != null) return `Round ${round_number}`;
  const t = round?.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? `Round ${t}` : t;
}

export async function signMediaUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

export { supabase };