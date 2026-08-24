import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, STATUS_LABELS, roundLabel, matchClockSeconds, formatClock, eventIcon, eventLabel, ratingClass, type Match, type Team, type MatchEvent, type Lineup, type Player, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { PlayCircle, Radio } from "lucide-react";
import { useTx, useNum, useDates } from "@/lib/auto-translate";
import { MatchChat } from "@/components/match-chat";
import { MatchPrediction } from "@/components/match-prediction";
import { MatchMomentum } from "@/components/match-momentum";
import { MapPin, Users } from "lucide-react";
import { FlagIcon } from "@/components/flag";
import { nationalOverrideMap, applyCallUp } from "@/lib/national";

/** Same slot keys the admin pitch board writes, so the public pitch mirrors it. */
function formationRows(formation: string | null | undefined): string[][] {
  const lines = (formation ?? "4-3-3").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const rows: string[][] = [["GK"]];
  let idx = 1;
  for (const [li, count] of lines.entries()) {
    const row: string[] = [];
    for (let i = 0; i < count; i++) row.push(`L${li + 1}-${i + 1}`);
    rows.push(row);
    idx += count;
  }
  void idx;
  return rows.reverse();
}

export const Route = createFileRoute("/matches/$id")({
  head: ({ params }) => ({ meta: [{ title: `Match — MansourAlmailScores` }, { name: "description", content: `Match center ${params.id}` }] }),
  component: MatchPage,
});

/** Crest + name that navigates to the club page. */
function TeamHeadline({ team, align }: { team: Team | null; align: "left" | "right" }) {
  const tx = useTx();
  const body = (
    <>
      <TeamCrest name={team?.name} logo={team?.logo_url} className="h-14 w-14" rounded="rounded-2xl" />
      <span className="mt-2 block text-lg font-bold">{tx(team?.name) ?? "TBD"}</span>
    </>
  );
  const cls = `flex flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`;
  if (!team) return <div className={cls}>{body}</div>;
  return <Link to="/teams/$id" params={{ id: team.id }} className={`${cls} transition hover:text-primary`}>{body}</Link>;
}

function MatchPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const [tab, setTab] = useState<"details" | "lineups" | "stats" | "standings" | "previous" | "media">("details");
  useRealtime(["matches", "match_events", "match_lineups", "player_ratings", "match_stats", "match_chat_messages", "media_items", "standings_rows"]);
  const m = useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url,is_national), away:away_team_id(id,name,logo_url,is_national), competition:competition_id(id,name,slug,logo_url,sport,country,country_code)")
        .eq("id", id).maybeSingle();
      return data as (Match & { home: Team | null; away: Team | null; competition: { id: string; name: string; slug: string; logo_url: string | null; sport: string; country: string | null; country_code: string | null } | null }) | null;
    },
  });
  const events = useQuery({
    queryKey: ["match-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events")
        .select("*, player:player_id(id,name), team:team_id(id,name)")
        .eq("match_id", id).order("minute").order("extra");
      return (data ?? []) as unknown as (MatchEvent & { player: Player | null; team: Team | null })[];
    },
  });
  const lineups = useQuery({
    queryKey: ["match-lineups", id, m.data?.home?.is_national, m.data?.away?.is_national],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups")
        .select("*, player:player_id(id,name,shirt_number,position,photo_url)")
        .eq("match_id", id);
      const rows = (data ?? []) as unknown as (Lineup & { player: Player | null })[];
      const overrides = await nationalOverrideMap([m.data?.home ?? null, m.data?.away ?? null]);
      if (overrides.size === 0) return rows;
      // national squads may use a different photo and shirt number for the same player
      return rows.map((row) => {
        const call = overrides.get(row.player_id);
        if (!call || !row.player) return row;
        return { ...row, shirt_number: row.shirt_number ?? call.shirt_number, player: applyCallUp(row.player, call) };
      });
    },
  });
  const stats = useQuery({ queryKey: ["match-stats", id], queryFn: async () => (await supabase.from("match_stats").select("*").eq("match_id", id).order("sort_order")).data ?? [] });
  const prediction = useQuery({ queryKey: ["match-prediction", id], queryFn: async () => (await supabase.from("match_predictions").select("*").eq("match_id", id).maybeSingle()).data });
  const broadcasts = useQuery({ queryKey: ["match-broadcasts", id], queryFn: async () => (await supabase.from("match_broadcasts").select("channel:broadcast_channels(id,name,logo_url,country_code)").eq("match_id", id)).data ?? [] });
  const media = useQuery({ queryKey: ["match-media", id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "match").eq("owner_id", id).order("sort_order")).data ?? [] });
  const ratings = useQuery({ queryKey: ["match-ratings", id], queryFn: async () => (await supabase.from("player_ratings").select("player_id,rating").eq("match_id", id)).data ?? [] });
  const [, tickClock] = useState(0);
  useEffect(() => {
    if (!m.data?.timer_running) return;
    const interval = window.setInterval(() => tickClock((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [m.data?.timer_running]);

  if (m.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!m.data) return <AppShell><EmptyState title={tx("Match not found")} /></AppShell>;
  const match = m.data;
  const isLive = ["live", "ht"].includes(match.status);
  const hasStarted = !["scheduled", "postponed", "cancelled"].includes(match.status);
  const lineupsVisible = match.lineups_published && (lineups.data?.length ?? 0) > 0;
  const tabs: ("details" | "lineups" | "stats" | "standings" | "previous" | "media")[] = ["details", ...(lineupsVisible ? ["lineups" as const] : []), "stats", "standings", "previous", "media"];
  const clock = matchClockSeconds(match);

  return (
    <AppShell>
      <BackButton />
      <div className="mb-6 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {match.competition ? (
            <Link to="/competitions/$slug" params={{ slug: match.competition.slug }} className="flex min-w-0 flex-wrap items-center gap-2 font-semibold hover:text-primary">
              {match.competition.logo_url && <img src={match.competition.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" />}
              <span className="capitalize">{tx(match.competition.sport)}</span>
              {match.competition.country && <><span>·</span><FlagIcon value={match.competition.country_code ?? match.competition.country} /><span>{tx(match.competition.country)}</span></>}
              <span>·</span><span>{tx(match.competition.name)}</span>
            </Link>
          ) : null}
          {roundLabel(match.round_number, match.round) ? <span>· {roundLabel(match.round_number, match.round)}</span> : null}
        </div>
        <div className="mt-4 grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <TeamHeadline team={match.home} align="right" />
          <div className="text-center">
            {["scheduled", "postponed", "cancelled"].includes(match.status) ? (
              <div className="text-sm font-medium text-muted-foreground">{num(dates.kickoff(match.kickoff_at))}</div>
            ) : (
              <div>
                <div className="text-4xl font-black tabular-nums">{num(match.home_score ?? 0)} – {num(match.away_score ?? 0)}</div>
                {match.status === "pen" && match.home_pen != null && match.away_pen != null && (
                  <div className="text-xs text-muted-foreground">({num(match.home_pen)}–{num(match.away_pen)} {tx("pens")})</div>
                )}
              </div>
            )}
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${isLive ? "bg-primary/15 text-primary" : "bg-muted"}`}>
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
              {match.status === "live" ? num(formatClock(clock)) : tx(STATUS_LABELS[match.status] ?? match.status)}
            </div>
          </div>
          <TeamHeadline team={match.away} align="left" />
        </div>
        {match.venue && <div className="mt-4 text-center text-xs text-muted-foreground">{tx(match.venue)}{match.city ? ` · ${tx(match.city)}` : ""}</div>}
      </div>

      <div className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-sm">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 px-4 py-2 font-semibold capitalize ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{tx(item === "media" ? "Media" : item === "previous" ? "Previous matches" : item === "details" ? "Details" : item === "lineups" ? "Lineups" : item === "standings" ? "Standings" : "Stats")}</button>)}
      </div>

      {tab === "details" && <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {hasStarted && !match.result_only && <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Timeline")}</div>
          {events.data && events.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {timelineWithBreaks(events.data, match.status, match.home_team_id).map((entry) => entry.kind === "divider" ? (
                <li key={entry.key} className="flex items-center justify-center gap-2 bg-muted/40 px-4 py-1.5 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
                  {tx(entry.label)}{entry.score ? <span className="tabular-nums">{num(entry.score)}</span> : null}
                </li>
              ) : (
                <li key={entry.event.id} className={`flex items-center gap-3 px-4 py-2.5 ${entry.side === "away" ? "flex-row-reverse text-end" : ""}`}>
                  <span className="w-9 shrink-0 font-mono text-[0.7rem] text-muted-foreground">{entry.event.minute != null ? num(entry.event.minute) : "-"}{entry.event.extra ? `+${num(entry.event.extra)}` : ""}'</span>
                  <EventIcon type={entry.event.type} />
                  <span className="min-w-0 flex-1">
                    {entry.event.player ? (
                      <Link to="/players/$id" params={{ id: entry.event.player.id }} className="block truncate text-sm font-semibold hover:text-primary">{tx(entry.event.player.name)}</Link>
                    ) : <span className="block truncate text-sm font-semibold">{entry.event.description ?? tx(entry.event.type)}</span>}
                    <span className="block truncate text-[0.65rem] text-muted-foreground">{tx(eventLabel(entry.event.type))}{entry.event.team ? ` · ${tx(entry.event.team.name)}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <div className="px-4 py-6 text-center text-sm text-muted-foreground">{tx("No events yet.")}</div>}
        </div>}

        <div className="space-y-4">
          {match.status === "scheduled" && <MatchPrediction matchId={id} homeLogo={match.home?.logo_url} awayLogo={match.away?.logo_url} fallback={prediction.data ?? null} />}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Match information")}</div>
            <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
              {([["Competition", tx(match.competition?.name)], ["Date & time", num(dates.kickoff(match.kickoff_at))], ["Stadium", tx(match.venue)], ["City", tx(match.city)], ["Referee", tx(match.referee)]] as [string, string | null | undefined][]).filter((item): item is [string, string] => !!item[1]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{k === "Stadium" ? <MapPin className="h-3 w-3" /> : k === "Referee" ? <Users className="h-3 w-3" /> : null}{tx(k)}</dt>
                  <dd className="mt-0.5 break-words font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground"><Radio className="h-3.5 w-3.5" /> {tx("Where to watch")}</div>
              <div className="flex flex-wrap gap-2 p-4">
                {broadcasts.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No channel yet.")}</p>}
                {broadcasts.data?.map((row, index) => {
                  const channel = Array.isArray(row.channel) ? row.channel[0] : row.channel;
                  return channel ? (
                    <div key={channel.id ?? index} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold">
                      {channel.logo_url && <img src={channel.logo_url} alt="" className="h-6 w-6 object-contain" />}{tx(channel.name)}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

          {match.highlight_url && <a href={match.highlight_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-semibold hover:border-primary"><PlayCircle className="h-5 w-5 text-primary" /> {tx("Watch match highlights")}</a>}
          <MatchChat matchId={id} />
        </div>
      </div>}

      {tab === "lineups" && lineupsVisible && <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{([["home", match.home, match.home_formation], ["away", match.away, match.away_formation]] as const).map(([side, team, formation]) => {
        const rows = lineups.data?.filter((item) => item.team_id === team?.id) ?? [];
        const starters = rows.filter((r) => r.is_starting);
        const bench = rows.filter((r) => !r.is_starting);
        const activeFormation = formation ?? "4-3-3";
        const showPitch = match.lineup_mode === "formation" && starters.length > 0;
        const marksFor = (playerId: string) => (events.data ?? [])
          .map((e) => {
            if (e.assist_player_id === playerId) return eventIcon("assist");
            if (e.player_id === playerId || e.player?.id === playerId) return eventIcon(e.type);
            if (e.sub_out_player_id === playerId) return eventIcon("substitution");
            return "";
          })
          .filter((icon) => icon && icon !== "•")
          .join("");
        return (
          <div key={side} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 font-bold">{tx(team?.name) ?? "TBD"}{showPitch && <span className="rounded bg-muted px-2 py-0.5 text-[0.65rem] font-semibold">{num(activeFormation)}</span>}</h3>
            {showPitch && (
              <div className="relative mb-4 space-y-2 overflow-hidden rounded-2xl p-3" style={{ background: "repeating-linear-gradient(180deg,#1b7a3f 0 28px,#17703a 28px 56px)" }}>
                <span className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/35" />
                <span className="pointer-events-none absolute left-2 right-2 top-1/2 border-t-2 border-white/35" />
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
                <span className="pointer-events-none absolute left-1/2 top-2 h-12 w-32 -translate-x-1/2 border-2 border-t-0 border-white/35" />
                <span className="pointer-events-none absolute bottom-2 left-1/2 h-12 w-32 -translate-x-1/2 border-2 border-b-0 border-white/35" />
                {formationRows(activeFormation).map((row, ri) => (
                <div key={ri} className="relative flex justify-around gap-1 pt-1">
                    {row.map((slot) => {
                      const lu = starters.find((s) => s.position_code === slot);
                      if (!lu) return <div key={slot} className="h-16 w-14" />;
                      const marks = marksFor(lu.player_id);
                      const pitchRating = ratings.data?.find((item) => item.player_id === lu.player_id)?.rating;
                      return (
                        <Link key={slot} to="/players/$id" params={{ id: lu.player_id }} className="relative z-10 flex w-16 flex-col items-center gap-0.5 pt-3 text-center">
                          <span className="relative block h-11 w-11 overflow-visible">
                            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-muted text-xs font-bold">
                              {lu.player?.photo_url ? <img src={lu.player.photo_url} alt="" className="h-full w-full object-cover" /> : num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}
                            </span>
                            {(lu.shirt_number ?? lu.player?.shirt_number) != null && (
                              <span className="absolute -left-1 -top-1 z-30 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[0.6rem] font-black leading-none text-foreground shadow ring-1 ring-border">{num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}</span>
                            )}
                            {marks && <span className="absolute -right-2 -top-2 z-30 flex min-h-5 min-w-5 items-center justify-center gap-px rounded-full bg-background px-1 text-[0.68rem] leading-none shadow ring-2 ring-background">{marks}</span>}
                          </span>
                          <span className="line-clamp-2 text-[0.6rem] font-semibold leading-tight text-white drop-shadow">{tx(lu.player?.name)}</span>
                          {pitchRating != null && <span className={`rounded px-1.5 text-[0.6rem] font-black leading-4 ${ratingClass(Number(pitchRating))}`}>{num(pitchRating)}</span>}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const list = showPitch ? bench : rows;
              const startersList = showPitch ? [] : list.filter((r) => r.is_starting);
              const benchList = showPitch ? bench : list.filter((r) => !r.is_starting);
              const row = (lu: (typeof rows)[number]) => {
                const rating = ratings.data?.find((item) => item.player_id === lu.player_id)?.rating;
                const marks = marksFor(lu.player_id);
                return (
                  <Link key={lu.id} to="/players/$id" params={{ id: lu.player_id }} className="flex items-center gap-3 border-t border-border py-2 first:border-0">
                    <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{num(lu.shirt_number ?? lu.player?.shirt_number ?? "")}</span>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">{lu.player?.photo_url && <img src={lu.player.photo_url} alt="" className="h-full w-full object-cover" />}</div>
                    <span className="min-w-0 flex-1 truncate font-semibold">{tx(lu.player?.name)}</span>
                    {marks && <span className="shrink-0 text-xs">{marks}</span>}
                    {rating != null && <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${ratingClass(Number(rating))}`}>{num(rating)}</span>}
                    {lu.is_starting && <span className="shrink-0 text-xs text-muted-foreground">{tx(lu.position_code ?? "XI")}</span>}
                  </Link>
                );
              };
              return (
                <>
                  {startersList.length > 0 && <div>{startersList.map(row)}</div>}
                  <TeamCoach teamId={team?.id} />
                  {benchList.length > 0 && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Bench")}</h4>
                      {benchList.map(row)}
                    </div>
                  )}
                </>
              );
            })()}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">{tx("No lineup posted.")}</p>}
          </div>
        );
      })}</div>
      <MatchMomentum matchId={id} home={match.home} away={match.away} minutes={match.momentum_minutes ?? 90} events={(events.data ?? []).map((e) => ({ minute: e.minute, type: e.type, team_id: e.team_id }))} />
      </div>}
      {tab === "stats" && <div className="rounded-2xl border border-border bg-card p-4">{stats.data && stats.data.length > 0 ? stats.data.map((item) => <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr] border-t border-border py-3 text-center first:border-0"><strong>{num(item.home_value)}</strong><span className="text-muted-foreground">{tx(item.label)}</span><strong>{num(item.away_value)}</strong></div>) : <p className="text-sm text-muted-foreground">{tx("No statistics published yet.")}</p>}</div>}
      {tab === "previous" && <PreviousMatches competitionId={match.competition_id} currentId={match.id} />}
      {tab === "standings" && <MatchStandings competitionId={match.competition_id} season={match.season} liveTeamIds={isLive ? [match.home_team_id, match.away_team_id].filter(Boolean) as string[] : []} highlightIds={[match.home_team_id, match.away_team_id].filter(Boolean) as string[]} />}
      {tab === "media" && <div><h3 className="mb-3 font-bold">{tx("Videos & media")}</h3><div className="grid gap-2">{media.data?.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{tx(item.title) || tx("Open media")}</div></a>)}{media.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No media posted.")}</p>}</div></div>}
    </AppShell>
  );
}

function PreviousMatches({ competitionId, currentId }: { competitionId: string; currentId: string }) {
  return <PreviousMatchesInner competitionId={competitionId} currentId={currentId} />;
}

/** Coach block under each lineup. */
function TeamCoach({ teamId }: { teamId: string | undefined }) {
  const tx = useTx();
  const q = useQuery({
    queryKey: ["lineup-coach", teamId],
    enabled: !!teamId,
    queryFn: async () => (await supabase.from("coaches").select("id,name,photo_url,nationality").eq("team_id", teamId!).limit(1).maybeSingle()).data,
  });
  if (!q.data) return null;
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Coach")}</h4>
      <Link to="/coaches/$id" params={{ id: q.data.id }} className="flex items-center gap-3 py-2 hover:text-primary">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">{q.data.photo_url && <img src={q.data.photo_url} alt="" className="h-full w-full object-cover" />}</div>
        <span className="min-w-0 flex-1 truncate font-semibold">{tx(q.data.name)}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{tx(q.data.nationality) ?? ""}</span>
      </Link>
    </div>
  );
}

function PreviousMatchesInner({ competitionId, currentId }: { competitionId: string; currentId: string }) {
  const tx = useTx();
  const q = useQuery({ queryKey: ["previous-matches", competitionId, currentId], queryFn: async () => (await supabase.from("matches").select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)").eq("competition_id", competitionId).neq("id", currentId).in("status", ["ft", "aet", "pen", "awarded"]).order("kickoff_at", { ascending: false }).limit(10)).data ?? [] });
  return <div className="grid gap-2">{q.data?.map((match) => <Link key={match.id} to="/matches/$id" params={{ id: match.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"><span className="min-w-0 flex-1 truncate font-semibold">{tx(match.home?.name) ?? "TBD"} vs {tx(match.away?.name) ?? "TBD"}</span><strong>{match.home_score ?? 0}–{match.away_score ?? 0}</strong></Link>)}{q.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No previous matches yet.")}</p>}</div>;
}

/** League table for the match's competition, with the two clubs highlighted (live-tinted while playing). */
function MatchStandings({ competitionId, season, liveTeamIds, highlightIds }: { competitionId: string; season: string | null; liveTeamIds: string[]; highlightIds: string[] }) {
  const tx = useTx();
  const num = useNum();
  const q = useQuery({
    queryKey: ["match-standings", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows").select("*, team:team_id(id,name,logo_url,short_name)").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query.order("group_label", { ascending: true, nullsFirst: true }).order("sort_order");
      return (data ?? []) as unknown as (StandingRow & { team: Team | null })[];
    },
  });
  if (!q.data?.length) return <EmptyState title={tx("No standings yet")} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-muted/50 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          <tr><th className="w-9 py-2.5 text-center">#</th><th className="py-2.5 text-start">{tx("Team")}</th><th className="w-9 text-center">{tx("P")}</th><th className="w-9 text-center">{tx("GD")}</th><th className="w-10 text-center">{tx("Pts")}</th></tr>
        </thead>
        <tbody>
          {q.data.map((row, i) => {
            const isLiveRow = row.team_id ? liveTeamIds.includes(row.team_id) : false;
            const isHighlight = row.team_id ? highlightIds.includes(row.team_id) : false;
            return (
              <tr key={row.id} className={`border-t border-border ${isLiveRow ? "bg-primary/15" : isHighlight ? "bg-accent/60" : ""}`}>
                <td className="py-2.5 text-center text-xs text-muted-foreground">{num(i + 1)}</td>
                <td className="py-2.5">
                  <Link to="/teams/$id" params={{ id: row.team_id }} className="flex min-w-0 items-center gap-2 hover:text-primary">
                    <TeamCrest name={row.team?.name} logo={row.team?.logo_url} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{tx(row.team?.name) ?? "—"}</span>
                    {isLiveRow && <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-primary">{tx("Live")}</span>}
                  </Link>
                </td>
                <td className="text-center text-xs tabular-nums">{num(row.played)}</td>
                <td className="text-center text-xs tabular-nums">{num(row.gf - row.ga)}</td>
                <td className="text-center text-xs font-black tabular-nums">{num(row.points + row.points_adjust)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function EventIcon({ type }: { type: string }) {
  return <span className="shrink-0 text-base leading-none">{eventIcon(type)}</span>;
}

type TimelineEvent = MatchEvent & { player: Player | null; team: Team | null };
type TimelineEntry =
  | { kind: "divider"; key: string; label: string; score?: string }
  | { kind: "event"; event: TimelineEvent; side: "home" | "away" };

/** Insert half-time and full-time dividers into an ordered event list. */
function timelineWithBreaks(events: TimelineEvent[], status: string, homeTeamId: string | null): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let htAdded = false;
  for (const event of events) {
    if (!htAdded && (event.minute ?? 0) > 45) {
      out.push({ kind: "divider", key: "ht", label: "HT" });
      htAdded = true;
    }
    out.push({ kind: "event", event, side: event.team_id && event.team_id !== homeTeamId ? "away" : "home" });
  }
  if (!["scheduled", "live", "ht"].includes(status)) out.push({ kind: "divider", key: "ft", label: "FT" });
  return out;
}