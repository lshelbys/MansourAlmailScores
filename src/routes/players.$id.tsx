import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaGallery } from "@/components/media-gallery";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, formatHeight, formatDob, type Player, type Team, type Match, type Transfer } from "@/lib/db";
import { FavoriteButton } from "@/hooks/use-favorites";
import { FlagIcon } from "@/components/flag";
import { useI18n } from "@/lib/i18n";
import { PlayerAvatar } from "@/components/player-avatar";
import { LinkedNews } from "@/components/linked-news";
import { formatMoney, useCurrency } from "@/lib/currency";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useTx } from "@/lib/auto-translate";
import { useDates, useNum } from "@/lib/auto-translate";
import { fetchPlayerNationalTeams, findNationalTeamByCountry } from "@/lib/national";

export const Route = createFileRoute("/players/$id")({
  head: () => ({
    meta: [
      { title: "Player — MansourAlmailScores" },
      { name: "description", content: "Player profile: details, transfer history, matches and media." },
      { property: "og:title", content: "Player — MansourAlmailScores" },
      { property: "og:description", content: "Player profile: details, transfer history, matches and media." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerPage,
});

type Tab = "details" | "matches" | "media" | "news";

type Comp = { id: string; slug: string; name: string; logo_url: string | null; country: string | null; country_code: string | null; sport: string | null };
type PlayerMatch = Match & { home: Team | null; away: Team | null; competition: Comp | null };
type PlayerMatchData = { rows: PlayerMatch[]; events: { match_id: string; type: string; player_id: string | null; assist_player_id: string | null }[]; ratings: Record<string, number> };

function age(dob: string | null | undefined) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function PlayerPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { t: tr } = useI18n();
  const { currency } = useCurrency();
  const [tab, setTab] = useState<Tab>("details");

  const q = useQuery({ queryKey: ["player", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*, team:team_id(id,name,logo_url)").eq("id", id).maybeSingle();
    return data as (Player & { team: Team | null }) | null;
  }});
  const transfers = useQuery({ queryKey: ["player-transfers", id], queryFn: async () => {
    const { data } = await supabase.from("transfers").select("*").eq("person_id", id).eq("person_type", "player")
      .order("moved_on", { ascending: false, nullsFirst: false });
    return (data ?? []) as Transfer[];
  }});
  const national = useQuery({ queryKey: ["player-national", id], queryFn: () => fetchPlayerNationalTeams(id) });
  const countryTeam = useQuery({
    enabled: !!q.data?.nationality || !!q.data?.nationality_code,
    queryKey: ["country-team", q.data?.nationality_code ?? q.data?.nationality],
    queryFn: () => findNationalTeamByCountry(q.data?.nationality, q.data?.nationality_code),
  });
  const matches = useQuery({ enabled: !!q.data, queryKey: ["player-matches", id], queryFn: async () => {
    const { data: lineups } = await supabase.from("match_lineups").select("match_id").eq("player_id", id);
    const ids = [...new Set((lineups ?? []).map((l) => l.match_id))];
    if (!ids.length) return { rows: [], events: [], ratings: {} as Record<string, number> };
    const [{ data }, { data: events }, { data: ratings }] = await Promise.all([
      supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), competition:competition_id(id,slug,name,logo_url,country,country_code,sport)")
        .in("id", ids).order("kickoff_at", { ascending: false }),
      supabase.from("match_events").select("match_id,type,player_id,assist_player_id").in("match_id", ids),
      supabase.from("player_ratings").select("match_id,rating").eq("player_id", id).in("match_id", ids),
    ]);
    return {
      rows: (data ?? []) as unknown as PlayerMatch[],
      events: (events ?? []).filter((e) => e.player_id === id || e.assist_player_id === id) as { match_id: string; type: string; player_id: string | null; assist_player_id: string | null }[],
      ratings: Object.fromEntries((ratings ?? []).filter((r) => r.match_id).map((r) => [r.match_id as string, Number(r.rating)])) as Record<string, number>,
    };
  }});
  const transferClubs = useQuery({
    enabled: (transfers.data?.length ?? 0) > 0,
    queryKey: ["player-transfer-clubs", id, transfers.data?.length ?? 0],
    queryFn: async () => {
      const names = [...new Set((transfers.data ?? []).flatMap((row) => [row.from_club, row.to_club]).filter((name): name is string => Boolean(name)))];
      if (names.length === 0) return [];
      const { data } = await supabase.from("teams").select("id,name,logo_url,is_temporary").in("name", names);
      return (data ?? []) as Pick<Team, "id" | "name" | "logo_url" | "is_temporary">[];
    },
  });

  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title={tx("Player not found")} /></AppShell>;
  const p = q.data;
  const nat = p.nationality_code ?? p.nationality;

  return (
    <AppShell>
      <BackButton />
       <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card p-4 sm:p-5">
         <div className="flex items-center gap-4">
           <PlayerAvatar src={p.photo_url} name={p.name} size="lg" className="border-2 border-border" />
           <div className="min-w-0 flex-1">
             <h1 className="text-sm font-bold leading-snug break-words sm:text-xl">{tx(p.name)}</h1>
            {p.team && (
              <Link to="/teams/$id" params={{ id: p.team.id }} className="mt-1 inline-flex min-w-0 max-w-full items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground hover:text-primary sm:text-sm">
                <TeamCrest name={p.team.name} logo={p.team.logo_url} className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                <span className="truncate">{tx(p.team.name)}</span>
              </Link>
            )}
          </div>
          <FavoriteButton kind="player" id={p.id} size="md" />
        </div>
        {(national.data?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {national.data!.map((call) => call.team ? (
              <Link key={call.id} to="/teams/$id" params={{ id: call.team.id }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[0.7rem] font-semibold hover:border-primary sm:text-xs">
                <FlagIcon value={call.team.country_code ?? call.team.country} size="sm" />
                <span className="truncate">{tx(call.team.name)}</span>
                <span className="text-muted-foreground">{tx("National team")}{call.shirt_number != null ? ` · #${call.shirt_number}` : ""}</span>
              </Link>
            ) : null)}
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-xs">
        {(["details", "matches", "media", "news"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-5 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tr(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
             {countryTeam.data ? (
               <Link to="/teams/$id" params={{ id: countryTeam.data.id }} className="block transition hover:opacity-80">
                 <Stat label={tx("Nationality")} value={tx(p.nationality) ?? "—"} icon={<FlagIcon value={nat} size="md" />} />
               </Link>
             ) : (
               <Stat label={tx("Nationality")} value={tx(p.nationality) ?? "—"} icon={<FlagIcon value={nat} size="md" />} />
             )}
             <Stat label={tx("Date of birth")} value={p.dob ? num(`${dates.dob(p.dob)}${age(p.dob) != null ? ` (${age(p.dob)})` : ""}`) : "—"} />
             <Stat label={tx("Height")} value={tx(num(formatHeight(p.height_cm, "cm")))} />
             <Stat label={tx("Position")} value={tx(p.position) ?? "—"} />
             <Stat label={tx("Shirt")} value={p.shirt_number != null ? num(`#${p.shirt_number}`) : "—"} />
             <Stat label={tx("Market value")} value={tx(num(formatMoney(p.market_value, currency)))} />
          </div>

           <h2 className="mb-3 mt-8 text-sm font-bold uppercase text-muted-foreground">{tx("Transfer history")}</h2>
          {transfers.data && transfers.data.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {transfers.data.map((r) => {
                const from = transferClubs.data?.find((team) => team.name === r.from_club);
                const to = transferClubs.data?.find((team) => team.name === r.to_club);
                return <div key={r.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 border-b border-border p-3 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)]">
                  <TeamCrest name={to?.name ?? r.to_club ?? r.from_club} logo={to?.logo_url ?? from?.logo_url ?? null} className="h-9 w-9 sm:h-10 sm:w-10" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8rem] font-semibold leading-snug sm:text-sm">
                      <span className="break-words">{tx(r.from_club) ?? tx("Free agent")}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-words">{tx(r.to_club) ?? tx("Free agent")}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground sm:text-xs">
                      <span>{tx(r.transfer_type)}</span>
                      {r.season && <span>{num(r.season)}</span>}
                      <span className="font-bold text-foreground">{r.fee ? tx(r.fee) : tx("Free")}</span>
                      {r.moved_on && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{num(dates.date(r.moved_on))}</span>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          ) : <EmptyState title={tx("No transfers recorded")} />}
        </>
      )}

      {tab === "matches" && (
        (matches.data?.rows.length ?? 0) > 0 ? (
          <PlayerMatches data={matches.data!} playerId={id} playerTeamId={p.team_id ?? null} />
        ) : <EmptyState title={tx("No matches yet")} />
      )}

      {tab === "media" && (
        (p.media_urls?.length ?? 0) > 0 ? (
          <MediaGallery urls={p.media_urls} />
        ) : <EmptyState title={tx("No media yet")} />
      )}

      {tab === "news" && <LinkedNews kind="player" id={p.id} />}
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 truncate text-sm font-bold">{icon}{value}</div>
    </div>
  );
}

const STATUS_SHORT: Record<string, string> = { finished: "FT", live: "LIVE", scheduled: "", postponed: "PST", cancelled: "CAN", awarded: "AWD", interrupted: "INT" };

function PlayerMatches({ data, playerId, playerTeamId }: { data: PlayerMatchData; playerId: string; playerTeamId: string | null }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const [comp, setComp] = useState<string>("all");

  const comps = [...new Map(data.rows.filter((m) => m.competition).map((m) => [m.competition!.id, m.competition!])).values()];
  const rows = comp === "all" ? data.rows : data.rows.filter((m) => m.competition?.id === comp);

  // consecutive groups by competition, preserving date order
  const groups: { comp: Comp | null; matches: PlayerMatch[] }[] = [];
  for (const m of rows) {
    const last = groups[groups.length - 1];
    if (last && last.comp?.id === (m.competition?.id ?? null)) last.matches.push(m);
    else groups.push({ comp: m.competition ?? null, matches: [m] });
  }

  return (
    <div className="space-y-3">
      <select value={comp} onChange={(e) => setComp(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold">
        <option value="all">{tx("All competitions")}</option>
        {comps.map((c) => <option key={c.id} value={c.id}>{tx(c.name)}</option>)}
      </select>

      {groups.map((g, gi) => (
        <section key={`${g.comp?.id ?? "none"}-${gi}`} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 px-3 py-3">
            <TeamCrest name={g.comp?.name} logo={g.comp?.logo_url} className="h-8 w-8" rounded="rounded-full" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{tx(g.comp?.name) ?? tx("Matches")}</div>
              <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <FlagIcon value={g.comp?.country_code ?? g.comp?.country} size="sm" />
                <span className="truncate">{tx(g.comp?.country) ?? ""}</span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {g.matches.map((m) => {
              const evs = data.events.filter((e) => e.match_id === m.id);
              const goals = evs.filter((e) => e.player_id === playerId && (e.type === "goal" || e.type === "penalty_goal")).length;
              const assists = evs.filter((e) => e.assist_player_id === playerId).length;
              const yellow = evs.some((e) => e.player_id === playerId && e.type === "yellow_card");
              const red = evs.some((e) => e.player_id === playerId && (e.type === "red_card" || e.type === "second_yellow"));
              const rating = data.ratings[m.id];
              const isHome = playerTeamId && m.home_team_id === playerTeamId;
              const isAway = playerTeamId && m.away_team_id === playerTeamId;
              return (
                <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent">
                  <div className="w-14 shrink-0 text-[0.65rem] leading-tight text-muted-foreground">
                    <div>{m.kickoff_at ? num(dates.date(m.kickoff_at)) : "—"}</div>
                    <div className="font-semibold">{tx(STATUS_SHORT[m.status] ?? "")}</div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <TeamLine team={m.home} dim={!!isAway} />
                    <TeamLine team={m.away} dim={!!isHome} />
                  </div>
                  <div className="flex w-12 shrink-0 items-center justify-end gap-0.5 text-[0.7rem]">
                    {goals > 0 && <span title={tx("Goal") ?? "Goal"}>⚽{goals > 1 ? num(String(goals)) : ""}</span>}
                    {assists > 0 && <span title={tx("Assist") ?? "Assist"}>👟</span>}
                    {yellow && <span className="h-3 w-2 rounded-sm bg-yellow-400" />}
                    {red && <span className="h-3 w-2 rounded-sm bg-red-600" />}
                  </div>
                  <div className="w-6 shrink-0 text-right text-sm font-bold leading-tight tabular-nums">
                    <div className={isAway ? "text-muted-foreground" : ""}>{m.home_score != null ? num(String(m.home_score)) : ""}</div>
                    <div className={isHome ? "text-muted-foreground" : ""}>{m.away_score != null ? num(String(m.away_score)) : ""}</div>
                  </div>
                  <div className="w-9 shrink-0 text-right text-[0.7rem] font-semibold text-muted-foreground">
                    {rating != null ? num(rating.toFixed(1)) : tx("N/A")}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TeamLine({ team, dim }: { team: Team | null; dim: boolean }) {
  const tx = useTx();
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[0.8rem] font-semibold ${dim ? "text-muted-foreground" : ""}`}>
      <TeamCrest name={team?.name} logo={team?.logo_url} className="h-4 w-4 shrink-0" rounded="rounded-full" />
      <span className="truncate">{tx(team?.name) ?? "TBD"}</span>
    </div>
  );
}