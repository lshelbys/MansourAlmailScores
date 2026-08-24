import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { Field, inputCls, btnPrimary, btnDanger } from "./ui";

type MediaItem = Database["public"]["Tables"]["media_items"]["Row"];
const SOURCES = ["youtube", "instagram", "facebook", "tiktok", "upload", "website"];

export function MediaManager({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "media", ownerType, ownerId];
  const [source, setSource] = useState("youtube");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("media_items").select("*").eq("owner_type", ownerType).eq("owner_id", ownerId).order("sort_order");
      return (data ?? []) as MediaItem[];
    },
  });

  const add = async () => {
    if (!url.trim()) return;
    await supabase.from("media_items").insert({ owner_type: ownerType, owner_id: ownerId, source, title: title.trim() || null, url: url.trim(), sort_order: q.data?.length ?? 0 } as never);
    setTitle(""); setUrl("");
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {(q.data ?? []).map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <span className="rounded bg-muted px-2 py-1 text-[0.65rem] font-bold uppercase">{item.source}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.title || item.url}</div><div className="truncate text-xs text-muted-foreground">{item.url}</div></div>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-muted-foreground" aria-label="Open media"><ExternalLink className="h-4 w-4" /></a>
            <button className={btnDanger} onClick={async () => { await supabase.from("media_items").delete().eq("id", item.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="grid gap-2 rounded-lg border border-border bg-background/50 p-3 sm:grid-cols-3">
        <Field label="Platform"><select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" /></Field>
        <Field label="Link"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <div className="sm:col-span-3"><button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add media</button></div>
      </div>
    </div>
  );
}

export function CompetitionAwardsManager({ competitionId }: { competitionId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "competition-awards", competitionId];
  const [type, setType] = useState("player_of_round");
  const [playerId, setPlayerId] = useState("");
  const [round, setRound] = useState("");
  const [season, setSeason] = useState("");
  const awards = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("competition_awards").select("*, player:players(id,name,photo_url)").eq("competition_id", competitionId).order("created_at", { ascending: false })).data ?? [] });
  const players = useQuery({ queryKey: ["admin", "competition-players", competitionId], queryFn: async () => {
    const { data: links } = await supabase.from("competition_teams").select("team_id").eq("competition_id", competitionId);
    const ids = (links ?? []).map((item) => item.team_id);
    if (!ids.length) return [];
    return (await supabase.from("players").select("id,name,photo_url,team_id").in("team_id", ids).order("name")).data ?? [];
  } });
  return <div className="space-y-3"><div className="grid gap-2">{awards.data?.map((award) => <div key={award.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"><div className="min-w-0 flex-1"><div className="font-semibold">{award.player?.name ?? "No player selected"}</div><div className="text-xs text-muted-foreground">{award.award_type === "player_of_round" ? `Player of round ${award.round_number ?? "—"}` : "Player of the season"}{award.season ? ` · ${award.season}` : ""}</div></div><button className={btnDanger} onClick={async () => { await supabase.from("competition_awards").delete().eq("id", award.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div><div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4"><Field label="Award"><select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}><option value="player_of_round">Player of the round</option><option value="player_of_season">Player of the season</option></select></Field><Field label="Player"><select className={inputCls} value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="">Choose player</option>{players.data?.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></Field>{type === "player_of_round" && <Field label="Round"><input type="number" min={1} className={inputCls} value={round} onChange={(e) => setRound(e.target.value)} /></Field>}<Field label="Season"><input className={inputCls} placeholder="26/27" value={season} onChange={(e) => setSeason(e.target.value)} /></Field><div className="sm:col-span-4"><button className={btnPrimary} disabled={!playerId} onClick={async () => { await supabase.from("competition_awards").insert({ competition_id: competitionId, award_type: type, player_id: playerId, round_number: type === "player_of_round" && round ? Number(round) : null, season: season || null } as never); setPlayerId(""); setRound(""); qc.invalidateQueries({ queryKey: key }); }}><Plus className="h-3.5 w-3.5" /> Add award</button></div></div></div>;
}