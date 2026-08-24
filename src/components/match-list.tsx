import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { FlagIcon } from "@/components/flag";
import { FavoriteButton, MatchNotificationButton } from "@/hooks/use-favorites";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import type { Match, Team } from "@/lib/db";
import { matchClockSeconds } from "@/lib/db";
import { useEffect, useState } from "react";

export type MatchWithTeams = Match & {
  home: Team | null;
  away: Team | null;
  competition: { slug: string; name: string; logo_url: string | null; country?: string | null; country_code?: string | null } | null;
};

/** Sofascore-style grouped list: one card per competition, compact rows inside. */
export function MatchGroups({ data }: { data: MatchWithTeams[] }) {
  const groups = new Map<string, MatchWithTeams[]>();
  for (const m of data) {
    const key = m.competition?.slug ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <div className="space-y-3">
      {[...groups.values()].map((ms) => (
        <div key={ms[0].competition?.slug ?? "other"} className="overflow-hidden rounded-2xl border border-border bg-card">
          <CompHeader m={ms[0]} />
          <div className="divide-y divide-border">
            {ms.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompHeader({ m }: { m: MatchWithTeams }) {
  const tx = useTx();
  const c = m.competition;
  const inner = (
    <>
      {c?.logo_url ? <img src={c.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" /> : <Trophy className="h-6 w-6 shrink-0 text-primary" />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{tx(c?.name) ?? tx("Matches")}</span>
        {c?.country ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlagIcon value={c.country_code ?? c.country} />
            <span className="truncate">{tx(c.country)}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  if (!c) return <div className="flex items-center gap-2.5 px-4 py-3">{inner}</div>;
  return (
    <Link to="/competitions/$slug" params={{ slug: c.slug }} className="flex items-center gap-2.5 px-4 py-3 hover:bg-accent">{inner}</Link>
  );
}

/** One compact fixture row: kickoff / status on the left, teams stacked, score or favourite on the right. */
export function MatchRow({ m, highlightTeamId }: { m: MatchWithTeams; highlightTeamId?: string }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const started = ["live", "ht", "ft", "aet", "pen", "awarded"].includes(m.status);
  const isLive = ["live", "ht"].includes(m.status);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!m.timer_running) return;
    const interval = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [m.timer_running]);
  const seconds = matchClockSeconds(m);
  const minute = Math.max(m.live_minute ?? 0, Math.floor(seconds / 60) + (seconds % 60 > 0 ? 1 : 0));
  const specialStatus = ["postponed", "cancelled", "interrupted"].includes(m.status);
  const line = (team: Team | null | undefined, score: number | null) => (
    <div className="flex min-w-0 items-center gap-2">
      <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate text-sm ${highlightTeamId && team?.id === highlightTeamId ? "font-bold" : "font-medium"}`}>{tx(team?.name) ?? "TBD"}</span>
      {started && <span className="shrink-0 text-sm font-bold tabular-nums">{num(score ?? 0)}</span>}
    </div>
  );
  return (
    <Link to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent">
      <div className="w-14 shrink-0 text-center text-[0.7rem] leading-tight text-muted-foreground">
        {isLive ? (
          <span className="font-bold text-destructive">{m.status === "live" ? `${num(minute)}'` : "HT"}</span>
        ) : (
          <>
            <div className="tabular-nums">{num(dates.kickoff(m.kickoff_at))}</div>
            {(started || specialStatus) && <div className="font-semibold uppercase">{m.status === "ft" ? "FT" : m.status.toUpperCase()}</div>}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 border-s border-border ps-3">
        {line(m.home, m.home_score)}
        {line(m.away, m.away_score)}
      </div>
       <div className="flex shrink-0 items-center gap-1">
         <MatchNotificationButton matchId={m.id} teamIds={[m.home_team_id, m.away_team_id]} />
         <FavoriteButton kind="match" id={m.id} />
       </div>
    </Link>
  );
}

