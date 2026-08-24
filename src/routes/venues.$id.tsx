import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, type Venue, type Team } from "@/lib/db";
import { FlagIcon } from "@/components/flag";
import { TeamCrest } from "@/components/team-crest";
import { MatchRow, type MatchWithTeams } from "@/components/match-list";
import { useNum, useTx } from "@/lib/auto-translate";
import { Landmark } from "lucide-react";

export const Route = createFileRoute("/venues/$id")({
  head: () => ({
    meta: [
      { title: "Stadium — MansourAlmailScores" },
      { name: "description", content: "Stadium profile: photo, capacity, city, country, resident clubs and upcoming matches." },
      { property: "og:title", content: "Stadium — MansourAlmailScores" },
      { property: "og:description", content: "Stadium profile: photo, capacity, city, country, resident clubs and upcoming matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VenuePage,
});

function VenuePage() {
  const { id } = Route.useParams();
  const tx = useTx();
  const num = useNum();

  const venue = useQuery({
    queryKey: ["venue", id],
    queryFn: async () => ((await supabase.from("venues").select("*").eq("id", id).maybeSingle()).data ?? null) as Venue | null,
  });
  const clubs = useQuery({
    enabled: !!venue.data,
    queryKey: ["venue-clubs", venue.data?.name],
    queryFn: async () => ((await supabase.from("teams").select("*").eq("venue_name", venue.data!.name).order("name")).data ?? []) as Team[],
  });
  const matches = useQuery({
    enabled: !!venue.data,
    queryKey: ["venue-matches", id],
    queryFn: async () => ((await supabase.from("matches")
      .select("*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), competition:competition_id(slug,name,logo_url,country,country_code)")
      .eq("venue_id", id).order("kickoff_at", { ascending: false }).limit(30)).data ?? []) as unknown as MatchWithTeams[],
  });

  if (venue.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!venue.data) return <AppShell><BackButton /><EmptyState title={tx("Stadium not found")} /></AppShell>;
  const v = venue.data;

  const cells: [string, string][] = [
    ["Capacity", v.capacity ? num(v.capacity.toLocaleString("en-US")) : "—"],
    ["City", tx(v.city) ?? "—"],
    ["Country", tx(v.country) ?? "—"],
    ["Clubs", String(clubs.data?.length ?? 0)],
  ];

  return (
    <AppShell>
      <BackButton />
      {v.image_url ? (
        <img src={v.image_url} alt={v.name} className="mb-4 h-56 w-full rounded-3xl border border-border object-cover sm:h-72" />
      ) : (
        <div className="mb-4 flex h-40 w-full items-center justify-center rounded-3xl border border-border bg-card"><Landmark className="h-10 w-10 text-muted-foreground" /></div>
      )}
      <h1 className="text-2xl font-bold">{tx(v.name)}</h1>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <FlagIcon value={v.country_code ?? v.country} />
        <span>{[tx(v.city), tx(v.country)].filter(Boolean).join(", ") || "—"}</span>
      </div>

      <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="bg-card p-4">
            <div className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">{tx(label)}</div>
            <div className="mt-1 font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {v.description && <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">{tx(v.description)}</p>}

      {clubs.data && clubs.data.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Resident clubs")}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.data.map((club) => (
              <Link key={club.id} to="/teams/$id" params={{ id: club.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50">
                <TeamCrest name={club.name} logo={club.logo_url} className="h-8 w-8 shrink-0" />
                <span className="min-w-0 truncate font-medium">{tx(club.name)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">{tx("Matches at this stadium")}</h2>
        {matches.data && matches.data.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {matches.data.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        ) : <EmptyState title={tx("No matches yet")} />}
      </section>
    </AppShell>
  );
}