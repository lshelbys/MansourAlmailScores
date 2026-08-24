import { supabase, type Player, type Team } from "@/lib/db";

/** A player called up to a national team. The call-up never changes his club. */
export type CallUp = {
  id: string;
  team_id: string;
  player_id: string;
  shirt_number: number | null;
  photo_url: string | null;
  position: string | null;
};

export type NationalPlayer = Player & { call_up: CallUp };

/** Call-ups for one or more national teams. */
export async function fetchCallUps(teamIds: string[]): Promise<CallUp[]> {
  const ids = teamIds.filter(Boolean);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("national_team_players").select("*").in("team_id", ids);
  return (data ?? []) as CallUp[];
}

/** Squad of a national team, with the national photo and shirt number applied. */
export async function fetchNationalSquad(teamId: string): Promise<NationalPlayer[]> {
  const calls = await fetchCallUps([teamId]);
  if (calls.length === 0) return [];
  const { data } = await supabase.from("players").select("*").in("id", calls.map((c) => c.player_id));
  return (data ?? []).map((player) => {
    const call = calls.find((c) => c.player_id === player.id)!;
    return { ...(player as Player), ...applyCallUp(player as Player, call), call_up: call };
  }).sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99));
}

/** Override photo, shirt number and position with the national-team versions when set. */
export function applyCallUp<T extends { photo_url?: string | null; shirt_number?: number | null; position?: string | null }>(player: T, call?: CallUp | null): T {
  if (!call) return player;
  return {
    ...player,
    photo_url: call.photo_url ?? player.photo_url ?? null,
    shirt_number: call.shirt_number ?? player.shirt_number ?? null,
    position: call.position ?? player.position ?? null,
  };
}

/** Build a player_id → call-up map for the given national teams. */
export async function nationalOverrideMap(teams: (Pick<Team, "id" | "is_national"> | null | undefined)[]): Promise<Map<string, CallUp>> {
  const ids = teams.filter((t): t is Pick<Team, "id" | "is_national"> => !!t?.is_national).map((t) => t.id);
  const calls = await fetchCallUps(ids);
  return new Map(calls.map((c) => [c.player_id, c]));
}

/** National teams a player has been called up to. */
export async function fetchPlayerNationalTeams(playerId: string): Promise<(CallUp & { team: Pick<Team, "id" | "name" | "logo_url" | "country" | "country_code"> | null })[]> {
  const { data } = await supabase
    .from("national_team_players")
    .select("*, team:team_id(id,name,logo_url,country,country_code)")
    .eq("player_id", playerId);
  return (data ?? []) as never;
}

/** The national team that represents a country, if it exists. */
export async function findNationalTeamByCountry(country: string | null | undefined, code?: string | null): Promise<Pick<Team, "id" | "name" | "logo_url"> | null> {
  if (!country && !code) return null;
  let query = supabase.from("teams").select("id,name,logo_url").eq("is_national", true).limit(1);
  query = code ? query.eq("country_code", code) : query.eq("country", country!);
  const { data } = await query.maybeSingle();
  return (data ?? null) as Pick<Team, "id" | "name" | "logo_url"> | null;
}
