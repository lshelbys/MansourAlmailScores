import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaGallery } from "@/components/media-gallery";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, formatKickoff, type Team, type Player, type Match, type StandingRow, type Coach, type Transfer } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { FavoriteButton } from "@/hooks/use-favorites";
import { FlagIcon } from "@/components/flag";
import { TeamCrest } from "@/components/team-crest";
import { useI18n } from "@/lib/i18n";
import { PlayerAvatar } from "@/components/player-avatar";
import { LinkedNews } from "@/components/linked-news";
import { ArrowRight, Landmark, CalendarClock, Crown, Trophy, Users } from "lucide-react";
import { MatchRow, type MatchWithTeams } from "@/components/match-list";
import { fetchNationalSquad } from "@/lib/national";
import { useDates, useNum, useTx } from "@/lib/auto-translate";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({
    meta: [
      { title: "Club — MansourAlmailScores" },
      { name: "description", content: "Club profile: matches, standings, squad, statistics, media and transfers." },
      { property: "og:title", content: "Club — MansourAlmailScores" },
      { property: "og:description", content: "Club profile: matches, standings, squad, statistics, media and transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

type Tab = "info" | "matches" | "standings" | "squad" | "stats" | "media" | "transfers" | "news";
const TABS: Tab[] = ["info", "matches", "standings", "squad", "stats", "media", "transfers", "news"];

function TeamPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { id } = Route.useParams();
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<Tab>("info");
  useRealtime(["teams", "players", "matches", "standings_rows", "transfers"]);

  const team = useQuery({ queryKey: ["team", id], queryFn: async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    return data as Team | null;
  }});
  const squad = useQuery({ queryKey: ["squad", id], queryFn: async () => {
    const { data } = await supabase.from("players").select("*").eq("team_id", id).order("shirt_number");
    return (data ?? []) as Player[];
  }});
  const nationalSquad = useQuery({ enabled: !!team.data?.is_national, queryKey: ["national-squad", id], queryFn: () => fetchNationalSquad(id) });
  const matches = useQuery({ queryKey: ["team-matches", id], queryFn: async () => {
    const { data } = await supabase.from("matches")
      .select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)")
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order("kickoff_at", { ascending: false });
    return (data ?? []) as unknown as MatchWithTeams[];
  }});
  const rows = useQuery({ queryKey: ["team-standings", id], queryFn: async () => {
    const { data: mine } = await supabase.from("standings_rows").select("competition_id").eq("team_id", id);
    const compIds = [...new Set((mine ?? []).map((r) => r.competition_id))];
    if (compIds.length === 0) return [];
    const { data } = await supabase.from("standings_rows")
      .select("*, competition:competition_id(name,slug), team:team_id(id,name,logo_url)")
      .in("competition_id", compIds)
      .order("sort_order");
    return (data ?? []) as unknown as (StandingRow & { competition: { name: string; slug: string } | null; team: { id: string; name: string; logo_url: string | null } | null })[];
  }});
  const coaches = useQuery({ queryKey: ["team-coaches", id], queryFn: async () => {
    const { data } = await supabase.from("coaches").select("*").eq("team_id", id);
    return (data ?? []) as Coach[];
  }});
  const transfers = useQuery({ queryKey: ["team-transfers", id, team.data?.name], enabled: !!team.data, queryFn: async () => {
    const name = team.data!.name;
    const { data } = await supabase.from("transfers").select("*")
       .or(`from_club.eq.${name},to_club.eq.${name}`).in("season", ["25/26", "26/27"]).order("moved_on", { ascending: false, nullsFirst: false });
    return (data ?? []) as Transfer[];
  }});
  const venue = useQuery({ queryKey: ["team-venue", team.data?.venue_name], enabled: !!team.data?.venue_name, queryFn: async () => {
    const { data } = await supabase.from("venues").select("id,name,city,capacity").eq("name", team.data!.venue_name!).maybeSingle();
    return (data ?? null) as { id: string; name: string; city: string | null; capacity: number | null } | null;
  }});

  if (team.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!team.data) return <AppShell><EmptyState title={tx("Club not found")} /></AppShell>;
  const t = team.data;
  if (t.is_temporary) {
    return (
      <AppShell>
      <BackButton />
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 text-center">
          <TeamCrest name={t.name} logo={t.logo_url} className="mx-auto h-16 w-16" rounded="rounded-2xl" />
          <h1 className="mt-4 text-xl font-bold">{tx(t.name)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{tx("Temporary club — no profile details are published for this club.")}</p>
        </div>
      </AppShell>
    );
  }

  const played = matches.data?.filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status)) ?? [];
  const wins = played.filter((m) => (m.home_team_id === id ? (m.home_score ?? 0) > (m.away_score ?? 0) : (m.away_score ?? 0) > (m.home_score ?? 0))).length;
  const draws = played.filter((m) => (m.home_score ?? 0) === (m.away_score ?? 0)).length;
  const losses = played.length - wins - draws;
  const gf = played.reduce((s, m) => s + (m.home_team_id === id ? m.home_score ?? 0 : m.away_score ?? 0), 0);
  const ga = played.reduce((s, m) => s + (m.home_team_id === id ? m.away_score ?? 0 : m.home_score ?? 0), 0);
  const upcoming = [...(matches.data ?? [])].filter((m) => m.status === "scheduled" && m.kickoff_at).sort((a, b) => new Date(a.kickoff_at!).getTime() - new Date(b.kickoff_at!).getTime());
  const featured = upcoming[0] ?? matches.data?.[0] ?? null;
  const tournaments = [...new Map((matches.data ?? []).filter((m) => m.competition).map((m) => [m.competition!.slug, m.competition!])).values()];

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-4 sm:p-5">
        <TeamCrest name={t.name} logo={t.logo_url} className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight sm:text-2xl">{tx(t.name)}</h1>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:text-xs">
            <FlagIcon value={t.country_code ?? t.country} />
            <span className="truncate">{tx(t.country)}</span>
          </div>
        </div>
        <FavoriteButton kind="team" id={t.id} size="md" />
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 text-xs">
        {TABS.map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tr(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "matches" && (
        matches.data && matches.data.length > 0 ? (
          <div className="space-y-3">
            {[...matches.data.reduce((map, m) => {
              const key = m.competition?.slug ?? "other";
              map.set(key, [...(map.get(key) ?? []), m]);
              return map;
            }, new Map<string, MatchWithTeams[]>()).values()].map((ms) => (
              <div key={ms[0].competition?.slug ?? "other"} className="overflow-hidden rounded-2xl border border-border bg-card">
                {ms[0].competition ? (
                  <Link to="/competitions/$slug" params={{ slug: ms[0].competition.slug }} className="flex items-center gap-2.5 border-b border-border px-4 py-3 hover:bg-accent">
                    {ms[0].competition.logo_url ? <img src={ms[0].competition.logo_url} alt="" className="h-7 w-7 shrink-0 object-contain" /> : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{tx(ms[0].competition.name)}</span>
                      {ms[0].competition.country ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FlagIcon value={ms[0].competition.country_code ?? ms[0].competition.country} />
                          <span className="truncate">{tx(ms[0].competition.country)}</span>
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ) : null}
                <div className="divide-y divide-border">
                  {ms.map((m) => <MatchRow key={m.id} m={m} highlightTeamId={id} />)}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title={tx("No matches yet")} />
      )}

      {tab === "standings" && (
        rows.data && rows.data.length > 0 ? (
          <div className="grid gap-6">
            {[...new Map(rows.data.map((r) => [r.competition_id, r])).values()].map((head) => {
              const group = rows.data!.filter((r) => r.competition_id === head.competition_id);
              return (
                <div key={head.competition_id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <Link to="/competitions/$slug" params={{ slug: head.competition?.slug ?? "" }} className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm font-bold hover:text-primary">
                    {tx(head.competition?.name) ?? tx("Competition")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <div className="divide-y divide-border">
                    {group.map((r, index) => (
                      <Link key={r.id} to="/teams/$id" params={{ id: r.team?.id ?? r.team_id }}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent ${r.team_id === id ? "bg-primary/10 font-bold" : ""}`}>
                        <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{num(index + 1)}</span>
                        <TeamCrest name={r.team?.name} logo={r.team?.logo_url} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{tx(r.team?.name) ?? tx("Team")}</span>
                        {r.qualification_label && <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold sm:inline" style={{ backgroundColor: `${r.qualification_color ?? "#888"}22`, color: r.qualification_color ?? undefined }}>{tx(r.qualification_label)}</span>}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{num(r.played)} · {num(r.gf)}:{num(r.ga)}</span>
                        <span className="w-8 shrink-0 text-end font-black tabular-nums">{num(r.points + r.points_adjust)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title={tx("Not in a table yet")} />
      )}

       {tab === "squad" && (
         <div className="space-y-7">
           <section><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Coach")}</h2>{coaches.data && coaches.data.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{coaches.data.map((coach) => <Link key={coach.id} to="/coaches/$id" params={{ id: coach.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50"><PlayerAvatar src={coach.photo_url} name={coach.name} size="sm" /><div><div className="font-medium">{tx(coach.name)}</div><div className="text-xs text-muted-foreground">{tx(coach.nationality) ?? "—"}</div></div></Link>)}</div> : <EmptyState title={tx("No coach")} />}</section>
           {(["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"] as const).map((position) => {
             const list: Player[] = t.is_national ? (nationalSquad.data ?? []) : (squad.data ?? []);
             const players = list.filter((player) => (player.position ?? "Unknown") === position);
             if (position === "Unknown" && players.length === 0) return null;
             return <section key={position}><h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx(position)}</h2>{players.length > 0 ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{players.map((p) => (
              <Link key={p.id} to="/players/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
                <PlayerAvatar src={p.photo_url} name={p.name} size="sm" />
                <div className="min-w-0"><div className="truncate font-medium">{tx(p.name)}</div><div className="truncate text-xs text-muted-foreground">{[p.shirt_number != null ? `#${p.shirt_number}` : null, tx(p.position)].filter(Boolean).join(" · ") || "—"}</div></div>
              </Link>
             ))}</div> : <EmptyState title={tx(`No ${position.toLowerCase()}s`)} />}</section>;
           })}
         </div>
      )}

      {tab === "info" && (
        <div className="space-y-4">
          {featured ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx(featured.status === "scheduled" ? "Next match" : "Featured match")}</div>
              <MatchRow m={featured} highlightTeamId={id} />
            </section>
          ) : null}

          <RecentForm matches={matches.data ?? []} teamId={id} />

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{tx("Tournaments")}</div>
            {tournaments.length > 0 ? (
              <div className="divide-y divide-border">
                {tournaments.map((c) => (
                  <Link key={c.slug} to="/competitions/$slug" params={{ slug: c.slug }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-accent">
                    {c.logo_url ? <img src={c.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" /> : null}
                    <span className="min-w-0 flex-1 truncate">{tx(c.name)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : <p className="p-4 text-sm text-muted-foreground">{tx("No tournaments yet")}</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="divide-y divide-border">
              {coaches.data?.[0] ? (
                <Link to="/coaches/$id" params={{ id: coaches.data[0].id }} className="block hover:bg-accent">
                  <DetailRow icon={<PlayerAvatar src={coaches.data[0].photo_url} name={coaches.data[0].name} size="sm" />} label={tx("Coach")} value={tx(coaches.data[0].name)} />
                </Link>
              ) : null}
              {t.chairman ? <DetailRow icon={<Crown className="h-5 w-5 text-muted-foreground" />} label={tx("Chairman")} value={tx(t.chairman)} /> : null}
              {t.country ? <DetailRow icon={<FlagIcon value={t.country_code ?? t.country} size="md" />} label={tx("Country")} value={tx(t.country)} /> : null}
              {t.short_name ? <DetailRow icon={<Users className="h-5 w-5 text-muted-foreground" />} label={tx("Short name")} value={t.short_name} /> : null}
              {t.trophies ? <DetailRow icon={<Trophy className="h-5 w-5 text-muted-foreground" />} label={tx("Trophies")} value={num(String(t.trophies))} /> : null}
              {t.founded_on ? <DetailRow icon={<CalendarClock className="h-5 w-5 text-muted-foreground" />} label={tx("Founded")} value={num(dates.date(t.founded_on, { dateStyle: "long" }))} /> : null}
              {t.venue_name ? (
                venue.data ? (
                  <Link to="/venues/$id" params={{ id: venue.data.id }} className="block hover:bg-accent">
                    <DetailRow icon={<Landmark className="h-5 w-5 text-muted-foreground" />} label={tx("Venue")} value={tx(t.venue_name)} chevron />
                  </Link>
                ) : <DetailRow icon={<Landmark className="h-5 w-5 text-muted-foreground" />} label={tx("Venue")} value={tx(t.venue_name)} />
              ) : null}
              {(venue.data?.capacity || t.venue_city || venue.data?.city) ? (
                <div className="flex divide-x divide-border">
                  {venue.data?.capacity ? (
                    <div className="flex-1 px-4 py-3 text-center">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{tx("Capacity")}</div>
                      <div className="mt-0.5 text-sm font-bold">{num(venue.data.capacity.toLocaleString())}</div>
                    </div>
                  ) : null}
                  {(t.venue_city ?? venue.data?.city) ? (
                    <div className="flex-1 px-4 py-3 text-center">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{tx("City")}</div>
                      <div className="mt-0.5 text-sm font-bold">{tx(t.venue_city ?? venue.data?.city)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
          {t.description ? <div className="rounded-2xl border border-border bg-card p-4 text-sm">{tx(t.description)}</div> : null}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <InfoCard label={tx("Played")} value={String(played.length)} />
          <InfoCard label={tx("Wins")} value={String(wins)} />
          <InfoCard label={tx("Draws")} value={String(draws)} />
          <InfoCard label={tx("Losses")} value={String(losses)} />
          <InfoCard label={tx("Goals for")} value={String(gf)} />
          <InfoCard label={tx("Goals against")} value={String(ga)} />
        </div>
      )}

      {tab === "media" && (
        (t.media_urls?.length ?? 0) > 0 ? (
          <MediaGallery urls={t.media_urls} />
        ) : <EmptyState title={tx("No media yet")} />
      )}

      {tab === "transfers" && (
        transfers.data && transfers.data.length > 0 ? (
          <div className="grid gap-2">
            {transfers.data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="flex-1 truncate">{r.from_club ?? "—"}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{r.to_club ?? "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.moved_on ? num(dates.date(r.moved_on)) : ""}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title={tx("No transfers yet")} />
      )}

      {tab === "news" && <LinkedNews kind="team" id={t.id} />}
    </AppShell>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return InfoCardInner({ label, value, icon });
}

function DetailRow({ icon, label, value, chevron }: { icon: React.ReactNode; label: string; value?: string | null; chevron?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-bold">{value ?? "—"}</span>
      </span>
      {chevron ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}

function InfoCardInner({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">{icon}{value}</div>
    </div>
  );
}

/** SofaScore-style form chart: opponent crests over win/draw/loss bars. */
function RecentForm({ matches, teamId }: { matches: MatchWithTeams[]; teamId: string }) {
  const tx = useTx();
  const played = matches
    .filter((m) => ["ft", "aet", "pen", "awarded"].includes(m.status))
    .slice(0, 10)
    .reverse();
  if (played.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-center text-sm font-bold">{tx("Recent form")}</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-muted/50 p-3">
        <div className="flex min-w-max items-stretch gap-2">
          {played.map((m) => {
            const home = m.home_team_id === teamId;
            const own = (home ? m.home_score : m.away_score) ?? 0;
            const other = (home ? m.away_score : m.home_score) ?? 0;
            const opp = home ? m.away : m.home;
            const result = own > other ? "w" : own === other ? "d" : "l";
            return (
              <Link key={m.id} to="/matches/$id" params={{ id: m.id }} className="flex w-12 flex-col items-center gap-2">
                <TeamCrest name={opp?.name} logo={opp?.logo_url} className="h-8 w-8" />
                <span className="flex h-28 w-full flex-col justify-center">
                  <span className="flex h-1/2 items-end justify-center">
                    {result === "w" && <span className="h-full w-8 rounded-t-sm bg-success" />}
                  </span>
                  <span className="flex h-1/2 items-start justify-center">
                    {result === "l" && <span className="h-full w-8 rounded-b-sm bg-destructive" />}
                    {result === "d" && <span className="h-1.5 w-8 rounded-sm bg-muted-foreground/50" />}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

