import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Player, type Team, type Competition } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { PlayerEditor } from "./player-editor";
import { releasePlayerToFreeAgent, deletePlayerForever } from "@/lib/player-moves";
import { PlayerAvatar } from "@/components/player-avatar";
import { FlagIcon } from "@/components/flag";
import { TeamCrest } from "@/components/team-crest";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PlayerBatchImport } from "./player-batch-import";
import { Plus, Sparkles, Pencil, Trash2, UserMinus, Users, ChevronRight, ChevronDown, X } from "lucide-react";

type Row = Player & { team: Pick<Team, "id" | "name"> | null };

/** Every player in the database — edit, release or delete permanently. */
export function PlayersPanel() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<"all" | "free">("all");
  const [editing, setEditing] = useState<Partial<Player> | null>(null);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [confirmPlayer, setConfirmPlayer] = useState<Row | null>(null);
  const [openComp, setOpenComp] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<{ id: string; name: string } | null>(null);
  const [compFilter, setCompFilter] = useState<{ id: string; name: string } | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [position, setPosition] = useState<string>("");
  const [batchOpen, setBatchOpen] = useState(false);

  const tree = useQuery({
    queryKey: ["admin", "player-tree"],
    queryFn: async () => {
      const [comps, teams] = await Promise.all([
        supabase.from("competitions").select("id,name,country,country_code,slug").order("name"),
        supabase.from("teams").select("id,name,logo_url,country,country_code,competition_id").order("name"),
      ]);
      return {
        competitions: (comps.data ?? []) as unknown as Competition[],
        teams: (teams.data ?? []) as unknown as Team[],
      };
    },
  });

  const countries = useMemo(() => {
    const map = new Map<string, { name: string; code: string | null }>();
    for (const c of tree.data?.competitions ?? []) if (c.country) map.set(c.country, { name: c.country, code: c.country_code ?? null });
    for (const t of tree.data?.teams ?? []) if (t.country) map.set(t.country, map.get(t.country) ?? { name: t.country, code: t.country_code ?? null });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tree.data]);

  const teamIdsForFilter = useMemo(() => {
    const teams = tree.data?.teams ?? [];
    if (teamFilter) return [teamFilter.id];
    if (compFilter) return teams.filter((t) => t.competition_id === compFilter.id).map((t) => t.id);
    if (countryFilter) {
      const compIds = new Set((tree.data?.competitions ?? []).filter((c) => c.country === countryFilter).map((c) => c.id));
      return teams.filter((t) => t.country === countryFilter || (t.competition_id && compIds.has(t.competition_id))).map((t) => t.id);
    }
    return null;
  }, [tree.data, teamFilter, compFilter, countryFilter]);

  const q = useQuery({
    queryKey: ["admin", "all-players", term, scope, position, teamIdsForFilter?.join(",") ?? "none"],
    queryFn: async () => {
      let query = supabase.from("players").select("*, team:team_id(id,name)").order("name").limit(300);
      if (term.trim().length > 1) query = query.ilike("name", `%${term.trim()}%`);
      if (scope === "free") query = query.is("team_id", null);
      if (position) query = query.eq("position", position);
      if (scope !== "free" && teamIdsForFilter) {
        if (teamIdsForFilter.length === 0) return [];
        query = query.in("team_id", teamIdsForFilter);
      }
      const { data } = await query;
      return (data ?? []) as unknown as Row[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "all-players"] });
  const clearFilters = () => { setTeamFilter(null); setCompFilter(null); setCountryFilter(null); };

  return (
    <div>
      <PlayerBatchImport open={batchOpen} onClose={() => setBatchOpen(false)} teamId={teamFilter?.id ?? null} onSaved={invalidate} />
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
        <div><h2 className="text-lg font-bold">Player library</h2><p className="text-xs text-muted-foreground">Edit anyone, release players to free agents or remove them from the database.</p></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search players…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <select className={`${inputCls} max-w-[10rem]`} value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">All positions</option>
          {["Goalkeeper", "Defender", "Midfielder", "Forward"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className={scope === "all" ? btnPrimary : btnGhost} onClick={() => setScope("all")}>All players</button>
        <button className={scope === "free" ? btnPrimary : btnGhost} onClick={() => setScope("free")}>Free agents</button>
        <button className={btnPrimary} onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" /> New player</button>
        <button className={btnGhost} onClick={() => setBatchOpen(true)}><Sparkles className="h-3.5 w-3.5" /> AI from photos</button>
      </div>

      {(countryFilter || compFilter || teamFilter) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtered by</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
            {[countryFilter, compFilter?.name, teamFilter?.name].filter(Boolean).join(" › ")}
            <button onClick={clearFilters}><X className="h-3 w-3" /></button>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-card p-2 text-sm">
          <button onClick={clearFilters} className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left font-semibold ${!countryFilter ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>All players</button>
          {countries.map((c) => {
            const comps = (tree.data?.competitions ?? []).filter((k) => k.country === c.name);
            const open = openCountry === c.name;
            return (
              <div key={c.name}>
                <button
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${countryFilter === c.name && !compFilter ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent"}`}
                  onClick={() => { setOpenCountry(open ? null : c.name); setCountryFilter(c.name); setCompFilter(null); setTeamFilter(null); }}>
                  {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <FlagIcon value={c.code ?? c.name} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </button>
                {open && (
                  <div className="ml-4 border-l border-border pl-2">
                    {comps.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No competitions</div>}
                    {comps.map((k) => {
                      const teams = (tree.data?.teams ?? []).filter((t) => t.competition_id === k.id);
                      const cOpen = openComp === k.id;
                      return (
                        <div key={k.id}>
                          <button
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${compFilter?.id === k.id && !teamFilter ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent"}`}
                            onClick={() => { setOpenComp(cOpen ? null : k.id); setCompFilter({ id: k.id, name: k.name }); setCountryFilter(c.name); setTeamFilter(null); }}>
                            {cOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                            <span className="min-w-0 flex-1 truncate">{k.name}</span>
                          </button>
                          {cOpen && (
                            <div className="ml-4 border-l border-border pl-2">
                              {teams.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No teams</div>}
                              {teams.map((t) => (
                                <button key={t.id}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${teamFilter?.id === t.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent"}`}
                                  onClick={() => { setTeamFilter({ id: t.id, name: t.name }); setCompFilter({ id: k.id, name: k.name }); setCountryFilter(c.name); setScope("all"); }}>
                                  <TeamCrest name={t.name} logo={t.logo_url} className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <div className="grid gap-2">
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            <PlayerAvatar src={p.photo_url} name={p.name} />
            <div className="min-w-0 flex-1 basis-40">
              <div className="truncate text-sm font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[p.team?.name ?? "Free agent", p.position, p.shirt_number ? `#${p.shirt_number}` : null].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            {p.team_id && <button className={btnGhost} onClick={async () => { await releasePlayerToFreeAgent(p, p.team?.name ?? null); invalidate(); }}><UserMinus className="h-3.5 w-3.5" /> Release</button>}
            <button className={btnDanger} onClick={() => setConfirmPlayer(p)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No players found.</div>}
        </div>
      </div>

      {editing && <PlayerEditor player={editing} teamId={editing.team_id ?? null} onClose={() => { setEditing(null); invalidate(); }} />}
      <ConfirmDelete
        open={!!confirmPlayer}
        title={`Delete ${confirmPlayer?.name ?? ""}`}
        description="This permanently removes the player from the database, including squad entries and history. This cannot be undone."
        confirmWord="DELETE"
        actionLabel="Delete player"
        onCancel={() => setConfirmPlayer(null)}
        onConfirm={async () => { await deletePlayerForever(confirmPlayer!.id); setConfirmPlayer(null); invalidate(); }}
      />
    </div>
  );
}
