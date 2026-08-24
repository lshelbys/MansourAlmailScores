import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { MatchGroups, type MatchWithTeams } from "@/components/match-list";
import { TeamCrest } from "@/components/team-crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { useFavorites } from "@/hooks/use-favorites";
import { supabase, type Competition, type Player, type Team } from "@/lib/db";
import { useTx } from "@/lib/auto-translate";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [
    { title: "Favorites — MansourAlmailScores" },
    { name: "description", content: "Your saved matches, clubs, players and competitions." },
    { property: "og:title", content: "Favorites — MansourAlmailScores" },
    { property: "og:description", content: "Your saved matches, clubs, players and competitions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const tx = useTx();
  const { favorites, ready } = useFavorites();
  const matches = useQuery({
    enabled: ready && favorites.match.length > 0,
    queryKey: ["favorites-page-matches", favorites.match.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*, home:home_team_id(id,name,logo_url,short_name), away:away_team_id(id,name,logo_url,short_name), competition:competition_id(slug,name,logo_url,country,country_code)").in("id", favorites.match).order("kickoff_at");
      return (data ?? []) as unknown as MatchWithTeams[];
    },
  });
  const teams = useQuery({ enabled: ready && favorites.team.length > 0, queryKey: ["favorites-page-teams", favorites.team.join(",")], queryFn: async () => ((await supabase.from("teams").select("*").in("id", favorites.team)).data ?? []) as Team[] });
  const players = useQuery({ enabled: ready && favorites.player.length > 0, queryKey: ["favorites-page-players", favorites.player.join(",")], queryFn: async () => ((await supabase.from("players").select("*").in("id", favorites.player)).data ?? []) as Player[] });
  const competitions = useQuery({ enabled: ready && favorites.competition.length > 0, queryKey: ["favorites-page-competitions", favorites.competition.join(",")], queryFn: async () => ((await supabase.from("competitions").select("*").in("id", favorites.competition)).data ?? []) as Competition[] });
  if (!ready) return <AppShell><LoadingSkeleton /></AppShell>;
  return <AppShell>
    <h1 className="mb-7 text-2xl font-bold">{tx("Favorites")}</h1>
    <FavoriteSection title={tx("Matches")}>{matches.data?.length ? <MatchGroups data={matches.data} /> : <EmptyState title={tx("No favorite matches yet")} />}</FavoriteSection>
    <FavoriteSection title={tx("Teams")}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{teams.data?.map((team) => <Link key={team.id} to="/teams/$id" params={{ id: team.id }} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"><TeamCrest name={team.name} logo={team.logo_url} className="h-10 w-10" /><span className="font-semibold">{tx(team.name)}</span></Link>)}{!teams.data?.length && <EmptyState title={tx("No favorite teams yet")} />}</div></FavoriteSection>
    <FavoriteSection title={tx("Players")}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{players.data?.map((player) => <Link key={player.id} to="/players/$id" params={{ id: player.id }} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary"><PlayerAvatar src={player.photo_url} name={player.name} /><span className="font-semibold">{tx(player.name)}</span></Link>)}{!players.data?.length && <EmptyState title={tx("No favorite players yet")} />}</div></FavoriteSection>
    <FavoriteSection title={tx("Competitions")}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{competitions.data?.map((competition) => <Link key={competition.id} to="/competitions/$slug" params={{ slug: competition.slug }} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary">{competition.logo_url ? <img src={competition.logo_url} alt="" className="h-10 w-10 object-contain" /> : <Trophy className="h-8 w-8 text-primary" />}<span className="font-semibold">{tx(competition.name)}</span></Link>)}{!competitions.data?.length && <EmptyState title={tx("No favorite competitions yet")} />}</div></FavoriteSection>
  </AppShell>;
}

function FavoriteSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-9"><SectionHeader title={title} />{children}</section>;
}