import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamCrest } from "@/components/team-crest";
import { FlagIcon } from "@/components/flag";
import { supabase, formatDate, type Coach } from "@/lib/db";
import { MatchGroups, type MatchWithTeams } from "@/components/match-list";
import { useTx } from "@/lib/auto-translate";
import { CalendarDays, Users, MapPin, Trophy, FileSignature, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/coaches/$id")({
  head: () => ({
    meta: [
      { title: "Coach profile — MansourAlmailScores" },
      { name: "description", content: "Coach profile with club, nationality and career details on MansourAlmailScores." },
      { property: "og:title", content: "Coach profile — MansourAlmailScores" },
      { property: "og:description", content: "Coach profile with club, nationality and career details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const tx = useTx();
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["coach", id],
    queryFn: async () => (await supabase.from("coaches").select("*, team:team_id(id,name,logo_url)").eq("id", id).maybeSingle()).data as
      | (Coach & { team: { id: string; name: string; logo_url: string | null } | null })
      | null,
  });

  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!q.data) return <AppShell><EmptyState title={tx("Coach not found")} /></AppShell>;
  const coach = q.data;
  return <CoachDetail coach={coach} />;
}

const SELECT_MATCH = "*, home:home_team_id(*), away:away_team_id(*), competition:competition_id(slug,name,logo_url,country,country_code)";

function CoachDetail({ coach }: { coach: Coach & { team: { id: string; name: string; logo_url: string | null } | null } }) {
  const tx = useTx();
  const teamId = coach.team?.id ?? null;

  const transfers = useQuery({
    queryKey: ["coach-transfers", coach.id],
    queryFn: async () => (await supabase.from("transfers").select("*").eq("person_type", "coach").eq("person_id", coach.id)
      .order("moved_on", { ascending: false })).data ?? [],
  });

  const matches = useQuery({
    enabled: !!teamId,
    queryKey: ["coach-matches", teamId],
    queryFn: async () => (await supabase.from("matches").select(SELECT_MATCH)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("kickoff_at", { ascending: false }).limit(30)).data as unknown as MatchWithTeams[] ?? [],
  });

  // Formation is read from the lineups actually set for his team — never typed in by hand.
  const formation = useQuery({
    enabled: !!teamId,
    queryKey: ["coach-formation", teamId],
    queryFn: async () => {
      const { data } = await supabase.from("matches")
        .select("home_team_id,away_team_id,home_formation,away_formation,kickoff_at")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("kickoff_at", { ascending: false }).limit(30);
      const shapes = (data ?? []).map((m) => (m.home_team_id === teamId ? m.home_formation : m.away_formation)).filter(Boolean) as string[];
      if (shapes.length === 0) return null;
      const counts = new Map<string, number>();
      for (const s of shapes) counts.set(s, (counts.get(s) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    },
  });

  return (
    <AppShell>
      <BackButton />
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <PlayerAvatar src={coach.photo_url} name={coach.name} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black">{tx(coach.name)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{tx("Coach")}</span>
              {coach.nationality && <span className="flex items-center gap-1"><FlagIcon value={coach.nationality_code ?? coach.nationality} />{tx(coach.nationality)}</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {coach.team && (
            <Link to="/teams/$id" params={{ id: coach.team.id }} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:border-primary">
              <TeamCrest name={coach.team.name} logo={coach.team.logo_url} className="h-8 w-8" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Club")}</div><div className="font-semibold">{tx(coach.team.name)}</div></div>
            </Link>
          )}
          {coach.dob && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Date of birth")}</div><div className="font-semibold">{formatDate(coach.dob)}</div></div>
            </div>
          )}
          {coach.birth_place && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Birth place")}</div><div className="font-semibold">{tx(coach.birth_place)}</div></div>
            </div>
          )}
          {coach.appointed_on && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Appointed")}</div><div className="font-semibold">{formatDate(coach.appointed_on)}</div></div>
            </div>
          )}
          {coach.contract_until && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <FileSignature className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Contract until")}</div><div className="font-semibold">{formatDate(coach.contract_until)}</div></div>
            </div>
          )}
          {formation.data && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Preferred formation")}</div><div className="font-semibold">{formation.data}</div></div>
            </div>
          )}
          {coach.trophies ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <div><div className="text-[0.65rem] uppercase text-muted-foreground">{tx("Trophies")}</div><div className="font-semibold">{coach.trophies}</div></div>
            </div>
          ) : null}
          {!coach.team && !coach.dob && !coach.bio && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm text-muted-foreground"><Users className="h-4 w-4" />{tx("No further details yet.")}</div>
          )}
        </div>
        {coach.bio && <p className="mt-4 rounded-2xl border border-border p-4 text-sm leading-relaxed">{tx(coach.bio)}</p>}
      </div>

      {transfers.data && transfers.data.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">{tx("Career history")}</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {transfers.data.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-3 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{tx(r.from_club ?? "—")}</span>
                <span className="text-muted-foreground">→</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{tx(r.to_club ?? "—")}</span>
                <span className="shrink-0 text-muted-foreground">{[r.transfer_type, r.moved_on ? formatDate(r.moved_on) : null].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {matches.data && matches.data.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">{tx("Matches")}</h2>
          <MatchGroups data={matches.data} />
        </section>
      )}
    </AppShell>
  );
}