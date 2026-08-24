import { TeamCrest } from "@/components/team-crest";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, BackButton, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, formatKickoff, type Competition, type Team, type Match, type StandingRow } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FlagIcon } from "@/components/flag";
import { LinkedNews } from "@/components/linked-news";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { MatchRow, type MatchWithTeams } from "@/components/match-list";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";
import { CalendarDays, ChevronRight, Play, Trophy } from "lucide-react";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];
type Row = StandingRow & { team: Team | null };

function groupsOf(rows: Row[]): [string | null, Row[]][] {
  const map = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.group_label ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()];
}

export const Route = createFileRoute("/competitions/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — MansourAlmailScores` }] }),
  component: CompetitionPage,
});

function CompetitionPage() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"overview" | "matches" | "standings" | "teams" | "awards" | "media" | "news">("overview");
  const [season, setSeason] = useState<string | null>(null);
  useRealtime(["competitions", "teams", "matches", "standings_rows", "competition_awards", "media_items"]);

  const comp = useQuery({
    queryKey: ["comp", slug],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").eq("slug", slug).maybeSingle();
      return data as Competition | null;
    },
  });

  const teams = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-teams", comp.data?.id, season],
    queryFn: async () => {
      let linkQuery = supabase.from("competition_teams").select("team_id").eq("competition_id", comp.data!.id);
      const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) linkQuery = linkQuery.eq("season", selectedSeason);
      const { data: links } = await linkQuery;
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : { data: [] };
      return (data ?? []) as Team[];
    },
  });

  const matches = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-matches", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("matches")
        .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query.order("kickoff_at");
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });

  const standings = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-standings", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows")
        .select("*, team:team_id(id,name,logo_url,short_name)")
        .eq("competition_id", comp.data!.id);
       const selectedSeason = season ?? comp.data!.season;
       if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query
        .order("group_label", { ascending: true, nullsFirst: true })
        .order("sort_order");
      return (data ?? []) as unknown as (StandingRow & { team: Team | null })[];
    },
  });

  const posLabels = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-position-labels", comp.data?.id, season],
    queryFn: async () => {
      let query = supabase.from("standings_position_labels").select("*").eq("competition_id", comp.data!.id);
      const selectedSeason = season ?? comp.data!.season;
      if (selectedSeason) query = query.eq("season", selectedSeason);
      const { data } = await query;
      return (data ?? []) as PositionLabel[];
    },
  });
  const media = useQuery({ enabled: !!comp.data, queryKey: ["competition-media", comp.data?.id], queryFn: async () => (await supabase.from("media_items").select("*").eq("owner_type", "competition").eq("owner_id", comp.data!.id).order("sort_order")).data ?? [] });
  const awards = useQuery({ enabled: !!comp.data, queryKey: ["competition-awards", comp.data?.id], queryFn: async () => (await supabase.from("competition_awards").select("*, player:players(id,name,photo_url)").eq("competition_id", comp.data!.id).order("created_at", { ascending: false })).data ?? [] });
  const titleHolder = teams.data?.find((team) => team.id === comp.data?.title_holder_team_id);
  const compTitles = useQuery({
    enabled: !!comp.data,
    queryKey: ["comp-titles", comp.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("competition_teams").select("team_id,titles").eq("competition_id", comp.data!.id).order("titles", { ascending: false });
      return (data ?? []) as { team_id: string; titles: number }[];
    },
  });
  const divisions = useQuery({
    enabled: !!comp.data && !!(comp.data.higher_division_id || comp.data.lower_division_id),
    queryKey: ["comp-divisions", comp.data?.higher_division_id, comp.data?.lower_division_id],
    queryFn: async () => {
      const ids = [comp.data!.higher_division_id, comp.data!.lower_division_id].filter((v): v is string => !!v);
      const { data } = await supabase.from("competitions").select("id,name,slug,logo_url").in("id", ids);
      return (data ?? []) as { id: string; name: string; slug: string; logo_url: string | null }[];
    },
  });
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { t } = useI18n();

  if (comp.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!comp.data) return <AppShell><EmptyState title="Competition not found" /></AppShell>;
  const c = comp.data;
  const friendly = c.format === "friendly";
  const tabs = friendly
    ? (["overview", "matches", "media", "news"] as const)
    : (["overview", "matches", "standings", "teams", "awards", "media", "news"] as const);

  return (
    <AppShell>
      <BackButton />
       <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border pb-3">
         <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary sm:h-14 sm:w-14">
          {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-7 w-7" />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight sm:text-2xl">{tx(c.name)}</h1>
           <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:text-xs">
            {!friendly && <FlagIcon value={c.country_code ?? c.country} />}
             <span className="truncate">{(friendly ? [tx(c.category)] : [tx(c.country), tx(c.category)]).filter(Boolean).join(" · ")}</span>
             {(c.seasons?.length ?? 0) > 0 && <select aria-label="Season" className="rounded-full border border-border bg-background px-2 py-0.5 text-[0.7rem] font-semibold text-foreground" value={season ?? c.season ?? c.seasons[0]} onChange={(e) => setSeason(e.target.value)}>{c.seasons.map((item) => <option key={item} value={item}>{num(item)}</option>)}</select>}
          </div>
        </div>
        <div className="col-span-2"><DurationBar startsOn={c.starts_on} endsOn={c.ends_on} /></div>
      </div>

      <div className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-border pb-2 text-xs sm:text-sm">
         {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 px-3 py-2 font-semibold capitalize sm:px-4 ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{item === "awards" ? tx("Awards") : t(`tab.${item}`)}</button>)}
      </div>

       {tab === "overview" && <CompetitionOverviewTab c={c} season={season} teams={teams.data ?? []} titleHolder={friendly ? null : (titleHolder ?? null)} titles={friendly ? [] : (compTitles.data ?? [])} divisions={friendly ? [] : (divisions.data ?? [])} matches={matches.data ?? []} media={media.data ?? []} friendly={friendly} />}

      {tab === "matches" && <><SectionHeader title={t("tab.matches")} />
      {matches.data && matches.data.length > 0 ? (
        <CompetitionMatches data={matches.data} />
      ) : <EmptyState title={tx("No matches yet")} />}</>}

      {tab === "standings" && !friendly && <><SectionHeader title={t("tab.standings")} action={<div />} />
      {standings.data && standings.data.length > 0 ? (
        <div className="space-y-6">
          {groupsOf(standings.data).map(([group, rows]) => {
            const labels = (posLabels.data ?? []).filter((l) => (l.group_label ?? null) === group);
            const used = rows
              .map((_, i) => labels.find((l) => l.position === i + 1))
              .filter((l): l is PositionLabel => !!l)
              .filter((l, i, arr) => arr.findIndex((x) => x.label === l.label) === i);
            return (
              <div key={group ?? "single"}>
                {group && <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{tx(group)}</div>}
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-muted/50 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground"><tr>
                       <th className="w-9 py-2.5 text-center">#</th>
                       <th className="py-2.5 ps-1 text-start">{tx("Team")}</th>
                      <th className="w-9 py-2.5 text-center">P</th><th className="w-9 py-2.5 text-center">W</th>
                      <th className="w-9 py-2.5 text-center">D</th><th className="w-9 py-2.5 text-center">L</th>
                      <th className="hidden w-9 py-2.5 text-center sm:table-cell">GF</th>
                      <th className="hidden w-9 py-2.5 text-center sm:table-cell">GA</th>
                      <th className="w-12 py-2.5 pe-3 text-center">Pts</th>
                    </tr></thead>
                    <tbody>{rows.map((r, i) => {
                      const lbl = labels.find((l) => l.position === i + 1);
                      return (
                        <tr key={r.id} className="border-t border-border align-middle" style={{ borderInlineStart: lbl ? `4px solid ${lbl.color}` : "4px solid transparent" }}>
                           <td className="py-2.5 text-center text-xs tabular-nums text-muted-foreground">{num(i + 1)}</td>
                          <td className="py-2.5 ps-1">
                            {r.team ? (
                              <Link to="/teams/$id" params={{ id: r.team.id }} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
                                <TeamCrest name={r.team.name} logo={r.team.logo_url} className="h-5 w-5 shrink-0" />
                                <span className="truncate">{tx(r.team.name)}</span>
                              </Link>
                            ) : "—"}
                          </td>
                           <td className="py-2.5 text-center tabular-nums">{num(r.played)}</td>
                           <td className="py-2.5 text-center tabular-nums">{num(r.won)}</td>
                           <td className="py-2.5 text-center tabular-nums">{num(r.drawn)}</td>
                           <td className="py-2.5 text-center tabular-nums">{num(r.lost)}</td>
                           <td className="hidden py-2.5 text-center tabular-nums sm:table-cell">{num(r.gf)}</td>
                           <td className="hidden py-2.5 text-center tabular-nums sm:table-cell">{num(r.ga)}</td>
                           <td className="py-2.5 pe-3 text-center font-bold tabular-nums">{num(r.points + r.points_adjust)}</td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
                {used.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {used.map((l) => (
                      <span key={l.id} className="inline-flex items-center gap-1.5">
                         <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{tx(l.label)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : <EmptyState title={tx("No standings yet")} />}</>}

      {tab === "teams" && !friendly && <><SectionHeader title={tx("Teams")} />
      {teams.data && teams.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.data.map((t) => (
            <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
              <TeamCrest name={t.name} logo={t.logo_url} className="h-8 w-8 shrink-0" />
              <div className="min-w-0"><div className="truncate font-medium">{tx(t.name)}</div><div className="truncate text-xs text-muted-foreground">{tx(t.country)}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title={tx("No teams yet")} />}</>}
      {tab === "awards" && !friendly && <>{awards.data && awards.data.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{awards.data.map((award) => <div key={award.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">{award.player?.photo_url ? <img src={award.player.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-muted" />}<div><div className="font-bold">{tx(award.player?.name) ?? tx("Player")}</div><div className="text-xs text-muted-foreground">{award.award_type === "player_of_round" ? `${tx("Player of round")} ${award.round_number ?? "—"}` : tx("Player of the season")}{award.season ? ` · ${award.season}` : ""}</div></div></div>)}</div> : <EmptyState title={tx("No competition awards yet")} />}</>}
      {tab === "media" && <>{media.data && media.data.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{media.data.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-card p-4 hover:border-primary"><div className="text-xs font-bold uppercase text-primary">{item.source}</div><div className="mt-1 font-semibold">{tx(item.title) || tx("Open media")}</div><div className="mt-1 truncate text-xs text-muted-foreground">{item.url}</div></a>)}</div> : <EmptyState title={tx("No competition media yet")} />}</>}
      {tab === "news" && <LinkedNews kind="competition" id={c.id} />}
    </AppShell>
  );
}

function CompetitionOverviewTab({ c, season, teams, titleHolder, titles, divisions, matches, media, friendly = false }: {
  c: Competition;
  season: string | null;
  teams: Team[];
  titleHolder: Team | null;
  titles: { team_id: string; titles: number }[];
  divisions: { id: string; name: string; slug: string; logo_url: string | null }[];
  matches: MatchWithTeams[];
  media: { id: string; url: string; source: string; title: string | null }[];
  friendly?: boolean;
}) {
  return <CompetitionOverviewInner c={c} season={season} teams={teams} titleHolder={titleHolder} titles={titles} divisions={divisions} matches={matches} media={media} friendly={friendly} />;
}

/** Sofascore-style rounds: one card per round, compact rows inside. */
function CompetitionMatches({ data }: { data: MatchWithTeams[] }) {
  const tx = useTx();
  const num = useNum();
  const groups = new Map<string, MatchWithTeams[]>();
  for (const m of data) {
    const key = m.round_number ? `#${m.round_number}` : (m.round ?? "");
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([key, ms]) => (
        <div key={key || "all"} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-bold">
            {key.startsWith("#") ? `${tx("Round")} ${num(Number(key.slice(1)))}` : (tx(key) || tx("Matches"))}
          </div>
          <div className="divide-y divide-border">
            {ms.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetitionOverviewInner({ c, season, teams, titleHolder, titles, divisions, matches, media, friendly = false }: {
  c: Competition;
  season: string | null;
  teams: Team[];
  titleHolder: Team | null;
  titles: { team_id: string; titles: number }[];
  divisions: { id: string; name: string; slug: string; logo_url: string | null }[];
  matches: MatchWithTeams[];
  media: { id: string; url: string; source: string; title: string | null }[];
  friendly?: boolean;
}) {
  const tx = useTx();
  const num = useNum();
  // Honours (title holder, most titles, title winners) belong to the live/newest season only.
  const isCurrentSeason = !season || !c.season || season === c.season;
  const showHonours = !friendly && isCurrentSeason;
  const winners = titles.filter((r) => r.titles > 0);
  const best = winners[0];
  const bestTeam = best ? teams.find((team) => team.id === best.team_id) : undefined;
  const higher = divisions.find((d) => d.id === c.higher_division_id);
  const lower = divisions.find((d) => d.id === c.lower_division_id);
  const featured = matches.find((match) => ["live", "ht"].includes(match.status)) ?? matches.find((match) => match.status === "scheduled") ?? matches.at(-1);
  const played = matches.filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status)).length;
  const cells: [string, string][] = friendly ? [
    ["Season", season ?? c.season ?? "—"],
    ["Matches", `${played}/${matches.length}`],
    ["Format", "Friendly"],
  ] : [
    ["Season", season ?? c.season ?? "—"],
    ["Teams", String(teams.length)],
    ["Matches", `${played}/${matches.length}`],
    ["Format", c.format],
    ["Sport", c.sport],
    ["Country", c.country ?? "—"],
  ];
  return (
    <div className="space-y-4">
      {/* Key numbers strip */}
      <section className={`grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border ${friendly ? "" : "sm:grid-cols-6"}`}>
        {cells.map(([label, value]) => (
          <div key={label} className="bg-card px-2.5 py-3 text-center">
            <div className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">{tx(label)}</div>
            <div className="mt-1 truncate text-xs font-bold tabular-nums sm:text-sm">{tx(value)}</div>
          </div>
        ))}
      </section>

      {featured && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[0.6rem] font-bold uppercase tracking-wide text-primary">{tx(featured.status === "scheduled" ? "Featured match" : "Latest match")}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{featured.round_number ? `${tx("Round")} ${num(featured.round_number)}` : tx(featured.round)}</div>
            </div>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <MatchRow m={featured} />
        </section>
      )}

      {showHonours && <div className="grid gap-3 sm:grid-cols-2">
        <TeamCell label={tx("Title holder")} team={titleHolder} />
        <TeamCell label={tx("Most titles")} team={bestTeam ?? null} note={best ? String(best.titles) : null} />
      </div>}

      {media.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Highlights and media")}</div>
          <div className="divide-y divide-border">
            {media.slice(0, 4).map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Play className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold sm:text-sm">{tx(item.title) ?? tx("Competition media")}</span>
                  <span className="block text-[0.65rem] uppercase text-muted-foreground">{tx(item.source)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      )}

      {showHonours && winners.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{tx("Title winners")}</div>
          <div className="divide-y divide-border">
            {winners.map((r) => {
              const team = teams.find((tm) => tm.id === r.team_id);
              return (
                <Link key={r.team_id} to="/teams/$id" params={{ id: r.team_id }} className="flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-accent sm:text-sm">
                  <TeamCrest name={team?.name} logo={team?.logo_url} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{tx(team?.name) ?? "Team"}</span>
                  <span className="font-black tabular-nums">{num(r.titles)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(higher || lower) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[higher, lower].filter((division): division is { id: string; name: string; slug: string; logo_url: string | null } => Boolean(division)).map((division) => (
            <Link key={division.id} to="/competitions/$slug" params={{ slug: division.slug }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary">
              {division.logo_url
                ? <img src={division.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
                : <Trophy className="h-6 w-6 shrink-0 text-primary" />}
              <div className="min-w-0 flex-1">
                <div className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">{division.id === c.higher_division_id ? tx("Higher division") : tx("Lower division")}</div>
                <div className="truncate text-xs font-semibold sm:text-sm">{tx(division.name)}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      {c.description && <p className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">{tx(c.description)}</p>}
    </div>
  );
}

function TeamCell({ label, team, note }: { label: string; team: Team | null; note?: string | null }) {
  const tx = useTx();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[0.65rem] font-bold uppercase text-muted-foreground">{tx(label)}</div>
      {team ? (
        <Link to="/teams/$id" params={{ id: team.id }} className="mt-2 flex items-center gap-2 text-sm font-semibold hover:text-primary">
          <TeamCrest name={team.name} logo={team.logo_url} className="h-7 w-7 shrink-0" />
          <span className="min-w-0 truncate">{tx(team.name)}</span>
          {note && <span className="ms-auto font-black tabular-nums">{note}</span>}
        </Link>
      ) : <div className="mt-2 text-sm font-semibold">—</div>}
    </div>
  );
}

/** Tournament duration as a live progress bar between the start and end dates. */
function DurationBar({ startsOn, endsOn }: { startsOn: string | null; endsOn: string | null }) {
  const tx = useTx();
  const dates = useDates();
  const num = useNum();
  if (!startsOn || !endsOn) return null;
  const start = new Date(startsOn).getTime();
  const end = new Date(endsOn).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const pct = Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
  return (
    <div>
      <div className="flex items-center justify-between text-[0.65rem] font-semibold tabular-nums text-muted-foreground">
        <span>{num(dates.dob(startsOn))}</span>
        <span className="uppercase tracking-wide">{tx("Duration")} · {num(pct)}%</span>
        <span>{num(dates.dob(endsOn))}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
