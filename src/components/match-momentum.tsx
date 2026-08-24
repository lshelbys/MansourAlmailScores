import { eventIcon, type Team } from "@/lib/db";
import { TeamCrest } from "@/components/team-crest";
import { useTx } from "@/lib/auto-translate";

export type MomentumEvent = { minute: number | null; type: string; team_id: string | null };

/** How strongly each event type pushes momentum, and how long its influence lasts (minutes). */
const WEIGHTS: Record<string, number> = {
  goal: 100, penalty_goal: 100, penalty: 100,
  penalty_miss: 55, missed_penalty: 55,
  own_goal: -85, var: 45, assist: 60,
  yellow: -35, second_yellow: -60, red: -75,
  substitution: 20, sub: 20,
};
const SPREAD = 7;

/** Momentum derived automatically from the match events — no manual drawing needed. */
function deriveMomentum(events: MomentumEvent[], total: number, homeId?: string, awayId?: string) {
  const values = new Array(total).fill(0) as number[];
  for (const e of events) {
    if (e.minute == null || !e.team_id) continue;
    const weight = WEIGHTS[e.type];
    if (!weight) continue;
    // positive = home pressure (red, on top), negative = away pressure (blue, below)
    const side = e.team_id === homeId ? 1 : e.team_id === awayId ? -1 : 0;
    if (!side) continue;
    const at = Math.min(Math.max(e.minute, 1), total);
    for (let m = Math.max(1, at - SPREAD); m <= Math.min(total, at + SPREAD); m++) {
      const falloff = 1 - Math.abs(m - at) / (SPREAD + 1);
      values[m - 1] += side * weight * falloff;
    }
  }
  return values.map((v, i) => ({ minute: i + 1, value: Math.max(-100, Math.min(100, Math.round(v))) }));
}

/** SofaScore-style match momentum: red = home (top), blue = away (bottom), black line = half time. */
export function MatchMomentum({
  home, away, minutes = 90, events = [],
}: { matchId: string; home: Team | null; away: Team | null; minutes?: number; events?: MomentumEvent[] }) {
  const tx = useTx();
  const total = Math.max(minutes, 90, ...events.map((e) => e.minute ?? 0));
  const list = deriveMomentum(events, total, home?.id, away?.id);
  if (list.every((item) => item.value === 0)) return null;
  const marks = events.filter((e) => e.minute != null && ["goal", "penalty_goal", "own_goal", "yellow", "second_yellow", "red", "substitution", "var"].includes(e.type));

  const markRow = (side: "home" | "away") => (
    <div className="relative h-6">
      {marks.filter((e) => (side === "home" ? e.team_id === home?.id : e.team_id === away?.id)).map((e, i) => (
        <span key={i} className="absolute -translate-x-1/2 text-sm leading-6" style={{ left: `${((Math.min(e.minute!, total) - 0.5) / total) * 100}%` }}>{eventIcon(e.type)}</span>
      ))}
    </div>
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide">{tx("Match momentum")}</h3>
      <div className="flex items-stretch gap-2">
        <div className="flex w-8 shrink-0 flex-col justify-between py-6">
          <TeamCrest name={home?.name} logo={home?.logo_url} className="h-7 w-7" />
          <TeamCrest name={away?.name} logo={away?.logo_url} className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          {markRow("home")}
          <div className="relative flex h-40 items-stretch overflow-hidden rounded-lg bg-muted/40">
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" />
            <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-foreground" style={{ left: `${(45 / total) * 100}%` }} />
            {list.map((item) => (
              <div key={item.minute} className="relative flex-1">
                {item.value > 0 && <span className="absolute bottom-1/2 left-px right-px rounded-t-sm bg-destructive" style={{ height: `${Math.min(Math.abs(item.value), 100) / 2}%` }} />}
                {item.value < 0 && <span className="absolute left-px right-px top-1/2 rounded-b-sm bg-primary" style={{ height: `${Math.min(Math.abs(item.value), 100) / 2}%` }} />}
              </div>
            ))}
          </div>
          {markRow("away")}
        </div>
      </div>
    </section>
  );
}