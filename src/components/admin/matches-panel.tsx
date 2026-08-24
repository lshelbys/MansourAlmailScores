import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Team, STATUS_LABELS, formatKickoff, roundLabel } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { VenueSelect } from "./venue-select";
import { MatchEditor } from "./match-editor";
import { Plus, Trash2, SlidersHorizontal, Flag, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createFixtureDraftsWithAlmail } from "@/lib/almail-ai.functions";
import { readAiImages } from "@/lib/image-files";
import { TeamCrest } from "@/components/team-crest";

export function MatchesPanel({ competitionId, season = null, friendly = false }: { competitionId: string; season?: string | null; friendly?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Match>>({ status: "scheduled" });
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [resultOf, setResultOf] = useState<Match | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "scheduled" | "live" | "finished" | "needs_result">("all");

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

  const matchesQ = useQuery({
    queryKey: ["admin", "matches", competitionId, season],
    queryFn: async () => {
      let query = supabase.from("matches").select("*").eq("competition_id", competitionId);
      if (season) query = query.eq("season", season);
      const { data } = await query.order("kickoff_at", { nullsFirst: true });
      return (data ?? []) as Match[];
    },
  });

  const teams = teamsQ.data ?? [];
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "TBD";
  const teamLogo = (id: string | null | undefined) => teams.find((t) => t.id === id)?.logo_url ?? null;
  const allMatches = matchesQ.data ?? [];

  const isPastRaw = (m: Match) => !!m.kickoff_at && new Date(m.kickoff_at).getTime() < Date.now();
  const noResultRaw = (m: Match) => m.home_score == null && m.away_score == null;

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allMatches.filter((m) => {
      if (term && !`${teamName(m.home_team_id)} ${teamName(m.away_team_id)}`.toLowerCase().includes(term)) return false;
      if (filter === "scheduled") return m.status === "scheduled";
      if (filter === "live") return ["live", "ht"].includes(m.status);
      if (filter === "finished") return !["scheduled", "live", "ht"].includes(m.status);
      if (filter === "needs_result") return isPastRaw(m) && noResultRaw(m);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches, search, filter, teams]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const k = friendly ? "All matches" : (roundLabel(m.round_number, m.round) ?? "Unassigned round");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()];
  }, [matches, friendly]);

  const create = async () => {
    if (!form.home_team_id || !form.away_team_id) { alert("Pick both teams first."); return; }
    await supabase.from("matches").insert({
      competition_id: competitionId,
      season,
      home_team_id: form.home_team_id,
      away_team_id: form.away_team_id,
      kickoff_at: form.kickoff_at ?? null,
      round_number: friendly ? null : (form.round_number ?? null),
      round: !friendly && form.round_number != null ? `Round ${form.round_number}` : null,
      venue: form.venue ?? null,
      city: form.city ?? null,
      status: "scheduled",
    } as never);
    setOpen(false); setForm({ status: "scheduled" });
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    await supabase.from("matches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] });
  };

  const isPast = isPastRaw;
  const noResult = noResultRaw;

  return (
    <div>
      <div className="mb-3 grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold">Matches <span className="text-xs font-medium text-muted-foreground">({allMatches.length})</span></h3>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => setAiOpen(true)}><Sparkles className="h-3.5 w-3.5" /> Almail AI</button>
            <button className={btnPrimary} onClick={() => { setForm({ status: "scheduled" }); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add match</button>
          </div>
        </div>
        <input className={inputCls} placeholder="Search by team…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([["all", "All"], ["needs_result", "Needs result"], ["live", "Live"], ["scheduled", "Upcoming"], ["finished", "Finished"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold ${filter === key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>
      <AlmailFixtureImporter
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        competitionId={competitionId}
        season={season}
        teams={teams}
        existing={allMatches}
        onImported={() => qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] })}
      />

      <div className="grid gap-5">
        {grouped.map(([round, list]) => (
          <div key={round}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-primary">{round}</span>
              <span className="text-[0.65rem] text-muted-foreground">{list.length} match{list.length === 1 ? "" : "es"}</span>
            </div>
            <div className="grid gap-2">
              {list.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="w-9 shrink-0 pt-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">{(STATUS_LABELS[m.status] ?? m.status)}</div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm">
                        <TeamCrest name={teamName(m.home_team_id)} logo={teamLogo(m.home_team_id)} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{teamName(m.home_team_id)}</span>
                        {m.home_score != null && <span className="shrink-0 tabular-nums">{m.home_score}</span>}
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm">
                        <TeamCrest name={teamName(m.away_team_id)} logo={teamLogo(m.away_team_id)} className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{teamName(m.away_team_id)}</span>
                        {m.away_score != null && <span className="shrink-0 tabular-nums">{m.away_score}</span>}
                      </div>
                      <div className="truncate text-[0.65rem] text-muted-foreground">{formatKickoff(m.kickoff_at)}{m.venue ? ` · ${m.venue}` : ""}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(isPast(m) && noResult(m) || m.status === "awarded") && <button className={btnPrimary} onClick={() => setResultOf(m)}><Flag className="h-3.5 w-3.5" /> {m.status === "awarded" ? "Set awarded score" : "End result"}</button>}
                    <button className={btnGhost} onClick={() => setEditingMatch(m)}><SlidersHorizontal className="h-3.5 w-3.5" /> Manage</button>
                    <button className={btnDanger} onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {matches.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{allMatches.length === 0 ? "No matches yet." : "No matches match this filter."}</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New match" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Home team">
            <select className={inputCls} value={form.home_team_id ?? ""} onChange={(e) => setForm({ ...form, home_team_id: e.target.value || null })}>
              <option value="">— select —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Away team">
            <select className={inputCls} value={form.away_team_id ?? ""} onChange={(e) => setForm({ ...form, away_team_id: e.target.value || null })}>
              <option value="">— select —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Date & time">
            <input type="datetime-local" className={inputCls}
              value={form.kickoff_at ? new Date(new Date(form.kickoff_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, kickoff_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </Field>
          {!friendly && <Field label="Round number"><input type="number" min={1} inputMode="numeric" className={inputCls} placeholder="1" value={form.round_number ?? ""} onChange={(e) => setForm({ ...form, round_number: e.target.value ? Number(e.target.value) : null })} /></Field>}
          <div className="sm:col-span-2">
            <Field label="Venue"><VenueSelect venue={form.venue} city={form.city} onChange={(v, c) => setForm({ ...form, venue: v, city: c })} /></Field>
          </div>
        </div>
        <p className="mt-3 text-[0.65rem] text-muted-foreground">Lineups, live events and the match clock become available once the match is created — open it with “Manage”.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={create}>Create match</button>
        </div>
      </Modal>

      {resultOf && <ResultModal match={resultOf} teamName={teamName} onClose={() => setResultOf(null)} onSaved={() => { setResultOf(null); qc.invalidateQueries({ queryKey: ["admin", "matches", competitionId] }); }} />}
      {editingMatch && <MatchEditor match={editingMatch} teams={teams} onClose={() => setEditingMatch(null)} />}
    </div>
  );
}

function ResultModal({ match, teamName, onClose, onSaved }: { match: Match; teamName: (id: string | null) => string; onClose: () => void; onSaved: () => void }) {
  const [hs, setHs] = useState<string>(match.home_score == null ? "" : String(match.home_score));
  const [as, setAs] = useState<string>(match.away_score == null ? "" : String(match.away_score));
  const [hp, setHp] = useState<string>("");
  const [ap, setAp] = useState<string>("");
  const [status, setStatus] = useState(match.status === "awarded" ? "awarded" : "ft");

  const save = async () => {
    await supabase.from("matches").update({
      home_score: hs === "" ? null : Number(hs),
      away_score: as === "" ? null : Number(as),
      home_pen: hp === "" ? null : Number(hp),
      away_pen: ap === "" ? null : Number(ap),
      status,
      timer_running: false,
    }).eq("id", match.id);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="End result">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={teamName(match.home_team_id)}><input type="number" className={inputCls} value={hs} onChange={(e) => setHs(e.target.value)} /></Field>
          <Field label={teamName(match.away_team_id)}><input type="number" className={inputCls} value={as} onChange={(e) => setAs(e.target.value)} /></Field>
        </div>
        <Field label="How did it end?">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABELS).filter(([k]) => !["scheduled", "live", "ht"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {status === "pen" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Home penalties"><input type="number" className={inputCls} value={hp} onChange={(e) => setHp(e.target.value)} /></Field>
            <Field label="Away penalties"><input type="number" className={inputCls} value={ap} onChange={(e) => setAp(e.target.value)} /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save result</button>
        </div>
      </div>
    </Modal>
  );
}

type FixtureRow = { home: string; away: string; kickoff_at: string | null; round_number: number | null; venue: string | null; city: string | null };

/** Almail AI reads a fixture list (text or screenshots) and stages matches for one-tap import. */
function AlmailFixtureImporter({ open, onClose, competitionId, season = null, teams, existing, onImported }: { open: boolean; onClose: () => void; competitionId: string; season?: string | null; teams: Team[]; existing: Match[]; onImported: () => void }) {
  const run = useServerFn(createFixtureDraftsWithAlmail);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<FixtureRow[]>([]);
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);

  const isTbd = (name: string) => /^(tbd|tba|\?+|-+|unknown)$/i.test(name.trim());
  const match = (name: string) => (isTbd(name) ? undefined : teams.find((t) => t.name.toLowerCase() === name.trim().toLowerCase())
    ?? teams.find((t) => t.name.toLowerCase().includes(name.trim().toLowerCase()) || name.trim().toLowerCase().includes(t.name.toLowerCase())));

  /** Same two clubs in the same competition/season = an update, not a new match. */
  const findExisting = (homeId: string | null, awayId: string | null) => {
    if (!homeId || !awayId) return undefined;
    return existing.find((m) => m.home_team_id === homeId && m.away_team_id === awayId)
      ?? existing.find((m) => m.home_team_id === awayId && m.away_team_id === homeId);
  };

  const analyse = async () => {
    setBusy(true); setError(null);
    try {
      const result = await run({ data: { notes, images, teams: teams.map((t) => t.name) } });
      setDrafts(result as FixtureRow[]);
      if ((result as FixtureRow[]).length === 0) setError("Almail AI could not find any matches in what you shared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Almail AI is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  const importAll = async () => {
    const rows = drafts
      .map((d) => ({ d, home: match(d.home), away: match(d.away) }))
      // A placeholder side stays empty so the match still imports as "TBD".
      .filter((r) => (r.home || isTbd(r.d.home)) && (r.away || isTbd(r.d.away)));
    if (rows.length === 0) { setError("None of the teams matched this competition’s squad list."); return; }

    const inserts: Record<string, unknown>[] = [];
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    for (const r of rows) {
      const found = findExisting(r.home?.id ?? null, r.away?.id ?? null);
      const patch: Record<string, unknown> = {
        kickoff_at: r.d.kickoff_at,
        round_number: r.d.round_number,
        round: r.d.round_number != null ? `Round ${r.d.round_number}` : null,
        venue: r.d.venue,
        city: r.d.city,
      };
      if (found) {
        // Only overwrite what the new sheet actually states.
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined));
        if (Object.keys(clean).length > 0) updates.push({ id: found.id, patch: clean });
      } else {
        inserts.push({
          competition_id: competitionId,
          season,
          home_team_id: r.home?.id ?? null,
          away_team_id: r.away?.id ?? null,
          ...patch,
          status: "scheduled",
        });
      }
    }

    setBusy(true);
    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("matches").insert(inserts as never);
      if (insertError) { setBusy(false); setError(insertError.message); return; }
    }
    for (const u of updates) {
      const { error: updateError } = await supabase.from("matches").update(u.patch as never).eq("id", u.id);
      if (updateError) { setBusy(false); setError(updateError.message); return; }
    }
    setBusy(false);
    setDrafts([]); setNotes(""); setImages([]); onImported(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Almail AI · import fixtures" wide>
      <div className="space-y-3">
        <Field label="Fixture notes">
          <textarea className={`${inputCls} min-h-28`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste a fixture list, or describe the matches…" />
        </Field>
        <Field label="Screenshots (optional)">
          <input type="file" accept="image/*" multiple className="text-xs" onChange={async (e) => { const files = e.target.files; if (files?.length) setImages(await readAiImages(files)); }} />
        </Field>
        {images.length > 0 && <div className="text-xs text-muted-foreground">{images.length} image(s) attached</div>}
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
        {drafts.length > 0 && (
          <div className="grid gap-2">
            {drafts.map((d, i) => {
              const home = match(d.home); const away = match(d.away);
              return (
                <div key={i} className="rounded-lg border border-border bg-background p-2 text-xs">
                  <div className="font-semibold">{d.home} vs {d.away}</div>
                  <div className="text-muted-foreground">{[d.kickoff_at ? formatKickoff(d.kickoff_at) : "No date", d.round_number != null ? `Round ${d.round_number}` : null, d.venue].filter(Boolean).join(" · ")}</div>
                  {((!home && !isTbd(d.home)) || (!away && !isTbd(d.away))) && <div className="mt-1 text-destructive">Team not found in this competition — add it first.</div>}
                  {(isTbd(d.home) || isTbd(d.away)) && <div className="mt-1 text-muted-foreground">Undecided side kept as TBD — set it later from the match editor.</div>}
                  {findExisting(home?.id ?? null, away?.id ?? null) && <div className="mt-1 font-semibold text-primary">Existing match — its date, round and venue will be updated.</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} disabled={busy} onClick={analyse}><Sparkles className="h-3.5 w-3.5" /> {busy ? "Reading…" : "Analyse with Almail AI"}</button>
          {drafts.length > 0 && <button className={btnPrimary} disabled={busy} onClick={importAll}><Plus className="h-3.5 w-3.5" /> Apply {drafts.length} match(es)</button>}
        </div>
      </div>
    </Modal>
  );
}
