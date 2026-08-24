import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, POSITIONS, type Team, type Player } from "@/lib/db";
import { fetchNationalSquad, type NationalPlayer } from "@/lib/national";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { PlayerAvatar } from "@/components/player-avatar";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Plus, Pencil, Trash2, UserMinus } from "lucide-react";

type PoolPlayer = Player & { team: { id: string; name: string } | null };

/** Call-ups for a national team: a player keeps his club and gets an optional national photo and shirt number. */
export function NationalSquadModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["admin", "call-ups", team.id];
  const [adding, setAdding] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [editing, setEditing] = useState<NationalPlayer | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<NationalPlayer | null>(null);

  const squad = useQuery({ queryKey: key, queryFn: () => fetchNationalSquad(team.id) });
  const pool = useQuery({
    enabled: adding && poolSearch.trim().length > 1,
    queryKey: ["admin", "call-up-pool", poolSearch.trim()],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*, team:team_id(id,name)").ilike("name", `%${poolSearch.trim()}%`).order("name").limit(40);
      return (data ?? []) as unknown as PoolPlayer[];
    },
  });
  const invalidate = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["national-squad", team.id] }); };

  const callUp = async (playerId: string) => {
    await supabase.from("national_team_players").insert({ team_id: team.id, player_id: playerId } as never);
    setPoolSearch(""); setAdding(false); invalidate();
  };

  return (
    <Modal open onClose={onClose} title={`${team.name} — call-ups`} wide>
      <p className="mb-3 text-xs text-muted-foreground">A call-up never changes the player's club. Add a national photo or shirt number to use it in national-team squads and lineups only.</p>
      <button className={btnPrimary} onClick={() => setAdding(!adding)}><Plus className="h-3.5 w-3.5" /> Call up a player</button>

      {adding && (
        <div className="mt-3 rounded-2xl border border-border bg-background/50 p-3">
          <Field label="Search any player by name">
            <input autoFocus className={inputCls} placeholder="Type a player name" value={poolSearch} onChange={(e) => setPoolSearch(e.target.value)} />
          </Field>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {(pool.data ?? []).filter((p) => !(squad.data ?? []).some((s) => s.id === p.id)).map((p) => (
              <button key={p.id} type="button" onClick={() => callUp(p.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background p-2 text-start hover:border-primary">
                <PlayerAvatar src={p.photo_url} name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground">{[p.team?.name ?? "Free agent", p.position, p.nationality].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
            {poolSearch.trim().length > 1 && (pool.data ?? []).length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{pool.isLoading ? "Searching…" : "No player matches that name"}</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5">
        {POSITIONS.map((position) => {
          const players = (squad.data ?? []).filter((p) => (p.position ?? "Unknown") === position);
          if (players.length === 0) return null;
          return (
            <section key={position}>
              <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{position}</h4>
              <div className="grid gap-2">
                {players.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                    <PlayerAvatar src={p.photo_url} name={p.name} />
                    <div className="min-w-0 flex-1 basis-32">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-[0.65rem] text-muted-foreground">{[p.shirt_number ? `#${p.shirt_number}` : null, p.call_up.photo_url ? "National photo" : "Club photo"].filter(Boolean).join(" · ")}</div>
                    </div>
                    <button className={btnGhost} onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /> National kit</button>
                    <button className={btnDanger} onClick={() => setConfirmRemove(p)}><UserMinus className="h-3 w-3" /> Remove</button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {squad.data && squad.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No call-ups yet.</div>}
      </div>

      {editing && <CallUpEditor player={editing} onClose={() => { setEditing(null); invalidate(); }} />}
      <ConfirmDelete
        open={!!confirmRemove}
        title={`Remove ${confirmRemove?.name ?? ""} from ${team.name}`}
        description="This only removes the national call-up. The player keeps his club and his record."
        confirmWord="REMOVE"
        actionLabel="Remove call-up"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => { await supabase.from("national_team_players").delete().eq("id", confirmRemove!.call_up.id); setConfirmRemove(null); invalidate(); }}
      />
    </Modal>
  );
}

function CallUpEditor({ player, onClose }: { player: NationalPlayer; onClose: () => void }) {
  const [shirt, setShirt] = useState<number | null>(player.call_up.shirt_number);
  const [photo, setPhoto] = useState<string | null>(player.call_up.photo_url);
  const [position, setPosition] = useState<string | null>(player.call_up.position);

  return (
    <Modal open onClose={onClose} title={`${player.name} — national kit`}>
      <div className="grid gap-3">
        <Field label="National shirt number">
          <input type="number" min={1} max={99} className={inputCls} value={shirt ?? ""} onChange={(e) => setShirt(e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Position for this national team">
          <select className={inputCls} value={position ?? ""} onChange={(e) => setPosition(e.target.value || null)}>
            <option value="">Same as club</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="National team photo">
          <ImageInput value={photo} onChange={setPhoto} onFile={async (f) => { const url = await uploadMedia("player-photos", f); if (url) setPhoto(url); }} />
        </Field>
        <p className="text-[0.65rem] text-muted-foreground">Leave the photo empty to keep his club photo. This photo is only used on national-team squads and lineups.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={async () => {
          await supabase.from("national_team_players").update({ shirt_number: shirt, photo_url: photo, position }).eq("id", player.call_up.id);
          onClose();
        }}><Plus className="h-3.5 w-3.5" /> Save</button>
      </div>
    </Modal>
  );
}
