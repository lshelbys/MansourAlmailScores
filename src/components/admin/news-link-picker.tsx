import { useQuery } from "@tanstack/react-query";
import { supabase, type Team, type Competition, type Player } from "@/lib/db";
import { Field, inputCls } from "./ui";

export type NewsLinks = { team_id: string | null; competition_id: string | null; player_id: string | null };

/** Links an article to an existing club, competition or player so it shows on that entity's News tab. */
export function NewsLinkPicker({ teamId, competitionId, playerId, onChange }: {
  teamId: string | null;
  competitionId: string | null;
  playerId: string | null;
  onChange: (links: NewsLinks) => void;
}) {
  const teams = useQuery({ queryKey: ["admin", "link-teams"], queryFn: async () => ((await supabase.from("teams").select("id,name").order("name")).data ?? []) as Pick<Team, "id" | "name">[] });
  const comps = useQuery({ queryKey: ["admin", "link-comps"], queryFn: async () => ((await supabase.from("competitions").select("id,name").order("name")).data ?? []) as Pick<Competition, "id" | "name">[] });
  const players = useQuery({ queryKey: ["admin", "link-players"], queryFn: async () => ((await supabase.from("players").select("id,name").order("name").limit(500)).data ?? []) as Pick<Player, "id" | "name">[] });

  const current: NewsLinks = { team_id: teamId, competition_id: competitionId, player_id: playerId };

  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-border p-3 sm:grid-cols-3">
      <Field label="Link to club">
        <select className={inputCls} value={teamId ?? ""} onChange={(e) => onChange({ ...current, team_id: e.target.value || null })}>
          <option value="">None</option>
          {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Link to competition">
        <select className={inputCls} value={competitionId ?? ""} onChange={(e) => onChange({ ...current, competition_id: e.target.value || null })}>
          <option value="">None</option>
          {(comps.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Link to player">
        <select className={inputCls} value={playerId ?? ""} onChange={(e) => onChange({ ...current, player_id: e.target.value || null })}>
          <option value="">None</option>
          {(players.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
