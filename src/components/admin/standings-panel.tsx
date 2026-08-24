import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, ordinal, type Team, type StandingRow, type StandingLabel } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost, Modal, Field } from "./ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, Tag } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PositionLabel = Database["public"]["Tables"]["standings_position_labels"]["Row"];

const SINGLE = "__single__";

export function StandingsPanel({ competitionId, season = null }: { competitionId: string; season?: string | null }) {
  const qc = useQueryClient();
  const [labelTarget, setLabelTarget] = useState<{ group: string | null; position: number } | null>(null);

  const teamsQ = useQuery({
    queryKey: ["admin", "teams", competitionId, season],
    queryFn: async () => {
      let linkQuery = supabase.from("competition_teams").select("team_id").eq("competition_id", competitionId);
      if (season) linkQuery = linkQuery.eq("season", season);
      const { data: links } = await linkQuery;
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : { data: [] };
      return (data ?? []) as Team[];
    },
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "standings", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_rows").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query.order("sort_order");
      return (data ?? []) as StandingRow[];
    },
  });

  const labelsQ = useQuery({
    queryKey: ["admin", "position-labels", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("standings_position_labels").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query;
      return (data ?? []) as PositionLabel[];
    },
  });

  const libraryQ = useQuery({
    queryKey: ["admin", "label-library"],
    queryFn: async () => {
      const { data } = await supabase.from("standing_labels").select("*").order("label");
      return (data ?? []) as StandingLabel[];
    },
  });

  const teams = teamsQ.data ?? [];
  const rows = rowsQ.data ?? [];
  const posLabels = labelsQ.data ?? [];
  const synced = useRef(false);

  // Auto-add every competition team to the table — no manual syncing.
  useEffect(() => {
    if (synced.current || teamsQ.isLoading || rowsQ.isLoading) return;
    const missing = teams.filter((t) => !rows.some((r) => r.team_id === t.id));
    if (missing.length === 0) return;
    synced.current = true;
    (async () => {
      await supabase.from("standings_rows").insert(
        missing.map((t, i) => ({ competition_id: competitionId, team_id: t.id, sort_order: rows.length + i, season })) as never,
      );
      qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId, season] });
      synced.current = false;
    })();
  }, [teams, rows, teamsQ.isLoading, rowsQ.isLoading, competitionId, season, qc]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.group_label ?? SINGLE);
    if (set.size === 0) set.add(SINGLE);
    return [...set].sort((a, b) => (a === SINGLE ? -1 : b === SINGLE ? 1 : a.localeCompare(b)));
  }, [rows]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId, season] });
    qc.invalidateQueries({ queryKey: ["admin", "position-labels", competitionId, season] });
  };

  const reorder = async (group: string, fromId: string, toId: string) => {
    const list = rows.filter((r) => (r.group_label ?? SINGLE) === group);
    const from = list.findIndex((r) => r.id === fromId);
    const to = list.findIndex((r) => r.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    qc.setQueryData<StandingRow[]>(["admin", "standings", competitionId, season], (old) =>
      (old ?? []).map((r) => {
        const idx = next.findIndex((n) => n.id === r.id);
        return idx >= 0 ? { ...r, sort_order: idx } : r;
      }),
    );
    await Promise.all(next.map((r, i) => supabase.from("standings_rows").update({ sort_order: i }).eq("id", r.id)));
    invalidate();
  };

  const addGroup = async () => {
    const name = window.prompt("Group name (e.g. Group A)");
    if (!name) return;
    // Convert an un-grouped table into the first group so rows stay visible.
    if (groups.length === 1 && groups[0] === SINGLE && rows.length > 0) {
      await supabase.from("standings_rows").update({ group_label: name }).eq("competition_id", competitionId).is("group_label", null);
    } else {
      qc.setQueryData<StandingRow[]>(["admin", "standings", competitionId, season], (o) => o ?? []);
    }
    invalidate();
    setPendingGroups((g) => (g.includes(name) ? g : [...g, name]));
  };

  const [pendingGroups, setPendingGroups] = useState<string[]>([]);
  const allGroups = useMemo(() => {
    const set = new Set(groups.filter((g) => g !== SINGLE || pendingGroups.length === 0));
    for (const g of pendingGroups) set.add(g);
    return [...set];
  }, [groups, pendingGroups]);

  const toSingleTable = async () => {
    await supabase.from("standings_rows").update({ group_label: null }).eq("competition_id", competitionId);
    setPendingGroups([]);
    invalidate();
  };

  const setRowGroup = async (rowId: string, group: string | null) => {
    await supabase.from("standings_rows").update({ group_label: group }).eq("id", rowId);
    invalidate();
  };

  const setAdjust = async (rowId: string, value: number) => {
    await supabase.from("standings_rows").update({ points_adjust: value }).eq("id", rowId);
    invalidate();
  };

  const removeRow = async (id: string) => {
    await supabase.from("standings_rows").delete().eq("id", id);
    invalidate();
  };

  const labelFor = (group: string, position: number) =>
    posLabels.find((l) => (l.group_label ?? SINGLE) === group && l.position === position) ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">Standings</h3>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={addGroup}><Plus className="h-3.5 w-3.5" /> Add group</button>
          {allGroups.some((g) => g !== SINGLE) && <button className={btnGhost} onClick={toSingleTable}>Single table</button>}
        </div>
      </div>

      {allGroups.map((group) => {
        const list = rows.filter((r) => (r.group_label ?? SINGLE) === group);
        return (
          <GroupTable
            key={group}
            title={group === SINGLE ? "Table" : group}
            rows={list}
            teams={teams}
            groups={allGroups}
            groupKey={group}
            labelFor={(pos) => labelFor(group, pos)}
            onLabelClick={(pos) => setLabelTarget({ group: group === SINGLE ? null : group, position: pos })}
            onReorder={(fromId, toId) => reorder(group, fromId, toId)}
            onGroupChange={setRowGroup}
            onAdjust={setAdjust}
            onRemove={removeRow}
          />
        );
      })}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          Add teams to this competition and they appear here automatically.
        </div>
      )}

      <p className="text-[0.65rem] text-muted-foreground">
        P/W/D/L/GF/GA/Pts are computed from finished matches. Drag a team to move it up or down. Labels stay attached to the
        position (1st place, 2nd place…), not to the team.
      </p>

      <LabelModal
        open={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        competitionId={competitionId}
        season={season}
        target={labelTarget}
        library={libraryQ.data ?? []}
        existing={labelTarget ? labelFor(labelTarget.group ?? SINGLE, labelTarget.position) : null}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin", "position-labels", competitionId, season] });
          qc.invalidateQueries({ queryKey: ["admin", "label-library"] });
          setLabelTarget(null);
        }}
      />
    </div>
  );
}

function GroupTable({
  title, rows, teams, groups, groupKey, labelFor, onLabelClick, onReorder, onGroupChange, onAdjust, onRemove,
}: {
  title: string;
  rows: StandingRow[];
  teams: Team[];
  groups: string[];
  groupKey: string;
  labelFor: (position: number) => PositionLabel | null;
  onLabelClick: (position: number) => void;
  onReorder: (fromId: string, toId: string) => void;
  onGroupChange: (rowId: string, group: string | null) => void;
  onAdjust: (rowId: string, value: number) => void;
  onRemove: (rowId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[780px] text-xs">
          <thead className="bg-background/50 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Position</th>
              <th className="p-2 text-left">Team</th>
              <th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th>
              <th className="p-2">GF</th><th className="p-2">GA</th><th className="p-2">Adj</th><th className="p-2">Pts</th>
              <th className="p-2 text-left">Qualification</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const team = teams.find((t) => t.id === r.team_id);
              const lbl = labelFor(i + 1);
              return (
                <tr
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId && dragId !== r.id) onReorder(dragId, r.id); setDragId(null); }}
                  className={`border-t border-border ${dragId === r.id ? "opacity-50" : ""}`}
                  style={{ borderLeft: lbl ? `4px solid ${lbl.color}` : undefined }}
                >
                  <td className="p-2">
                    <div className="flex cursor-grab items-center gap-2 font-semibold">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      {ordinal(i + 1)} place
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {team?.logo_url && <img src={team.logo_url} alt="" className="h-5 w-5 object-contain" />}
                      <span className="truncate">{team?.name ?? "?"}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center tabular-nums">{r.played}</td>
                  <td className="p-2 text-center tabular-nums">{r.won}</td>
                  <td className="p-2 text-center tabular-nums">{r.drawn}</td>
                  <td className="p-2 text-center tabular-nums">{r.lost}</td>
                  <td className="p-2 text-center tabular-nums">{r.gf}</td>
                  <td className="p-2 text-center tabular-nums">{r.ga}</td>
                  <td className="p-1">
                    <input type="number" defaultValue={r.points_adjust}
                      onBlur={(e) => onAdjust(r.id, Number(e.target.value) || 0)}
                      className="w-14 rounded border border-border bg-background px-2 py-1 text-xs" />
                  </td>
                  <td className="p-2 text-center font-bold">{r.points + r.points_adjust}</td>
                  <td className="p-2">
                    <button onClick={() => onLabelClick(i + 1)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[0.65rem] font-medium hover:bg-accent">
                      {lbl ? (
                        <>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: lbl.color }} />
                          <span className="max-w-[10rem] truncate">{lbl.label}</span>
                        </>
                      ) : (
                        <><Tag className="h-3 w-3 text-muted-foreground" /> Add label</>
                      )}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {groups.length > 1 && (
                        <select value={groupKey} onChange={(e) => onGroupChange(r.id, e.target.value === SINGLE ? null : e.target.value)}
                          className="rounded border border-border bg-background px-1 py-1 text-[0.65rem]">
                          {groups.map((g) => <option key={g} value={g}>{g === SINGLE ? "No group" : g}</option>)}
                        </select>
                      )}
                      <button onClick={() => onRemove(r.id)} className="text-destructive" title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No teams in this table yet.</div>}
      </div>
    </div>
  );
}

function LabelModal({
  open, onClose, competitionId, season, target, library, existing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  competitionId: string;
  season: string | null;
  target: { group: string | null; position: number } | null;
  library: StandingLabel[];
  existing: PositionLabel | null;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLabel(existing?.label ?? "");
    setColor(existing?.color ?? "#2563eb");
  }, [existing, open]);

  if (!open || !target) return null;

  const apply = async (text: string, hex: string, store: boolean) => {
    setBusy(true);
    try {
      if (existing) {
        await supabase.from("standings_position_labels").update({ label: text, color: hex }).eq("id", existing.id);
      } else {
        await supabase.from("standings_position_labels").insert({
          competition_id: competitionId, season, group_label: target.group, position: target.position, label: text, color: hex,
        } as never);
      }
      if (store && !library.some((l) => l.label.toLowerCase() === text.toLowerCase())) {
        await supabase.from("standing_labels").insert({ competition_id: competitionId, label: text, color: hex } as never);
      }
      onSaved();
    } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!existing) return onClose();
    setBusy(true);
    try {
      await supabase.from("standings_position_labels").delete().eq("id", existing.id);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${ordinal(target.position)} place — qualification label`}>
      <div className="space-y-5">
        {library.length > 0 && (
          <div>
            <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Use an existing label</div>
            <div className="flex flex-wrap gap-2">
              {library.map((l) => (
                <button key={l.id} disabled={busy} onClick={() => apply(l.label, l.color, false)}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">New label</div>
          <Field label="Label">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AFC Champions League Two" />
          </Field>
          <Field label="Label color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 rounded border border-border bg-background" />
          </Field>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
            Save this label for future use
          </label>
          <div className="flex items-center gap-2">
            <button disabled={busy || !label.trim()} className={btnPrimary} onClick={() => apply(label.trim(), color, saveToLibrary)}>Save label</button>
            {existing && <button disabled={busy} className={btnGhost} onClick={clear}>Remove label</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
