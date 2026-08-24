import { supabase, currentSeason, type Player } from "@/lib/db";

const today = () => new Date().toISOString().slice(0, 10);

/** Remove a player from his club: he becomes a free agent and keeps his record. */
export async function releasePlayerToFreeAgent(player: Pick<Player, "id">, fromClub: string | null) {
  await supabase.from("players").update({ team_id: null }).eq("id", player.id);
  await supabase.from("transfers").insert({
    person_type: "player", person_id: player.id, from_club: fromClub, to_club: null,
    transfer_type: "Free agent", moved_on: today(), season: currentSeason(),
  } as never);
}

/** Move a player to another club and log the transfer automatically. */
export async function transferPlayerToClub(player: Pick<Player, "id">, fromClub: string | null, toTeamId: string, toClub: string, transferType = "Transfer") {
  await supabase.from("players").update({ team_id: toTeamId }).eq("id", player.id);
  await supabase.from("transfers").insert({
    person_type: "player", person_id: player.id, from_club: fromClub, to_club: toClub,
    transfer_type: transferType, moved_on: today(), season: currentSeason(),
  } as never);
}

/** Permanently delete a player and his transfer history. */
export async function deletePlayerForever(playerId: string) {
  await supabase.from("transfers").delete().eq("person_type", "player").eq("person_id", playerId);
  await supabase.from("players").delete().eq("id", playerId);
}
