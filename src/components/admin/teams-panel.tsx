import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, POSITIONS, type Team, type Player, type Coach } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { CountrySelect } from "@/components/country-select";
import { COUNTRIES } from "@/lib/countries";
import { DateWheel } from "@/components/date-wheel";
import { TransfersEditor } from "./transfers-editor";
import { PlayerEditor } from "./player-editor";
import { PlayerAvatar } from "@/components/player-avatar";
import { releasePlayerToFreeAgent, transferPlayerToClub, deletePlayerForever } from "@/lib/player-moves";
import { TeamCrest } from "@/components/team-crest";
import { ConfirmDelete } from "@/components/confirm-delete";
import { VenueSelect } from "./venue-select";
import { MediaUrls } from "./media-urls";
import { NationalSquadModal } from "./national-squad-modal";
import { Plus, Pencil, Trash2, Users, UserCog, UserMinus, ImagePlus, Library, Flag } from "lucide-react";

type TeamForm = Partial<Team>;
type PlayerForm = Partial<Player>;
type CoachForm = Partial<Coach>;

export function TeamsPanel({ competitionId, season = null }: { competitionId: string | null; season?: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeamForm>({});
  const [squadOf, setSquadOf] = useState<Team | null>(null);
  const [staffOf, setStaffOf] = useState<Team | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTeamId, setLibraryTeamId] = useState("");
  const [kind, setKind] = useState<"all" | "clubs" | "national">("all");
  const [search, setSearch] = useState("");
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);


  const q = useQuery({
    queryKey: ["admin", "teams", competitionId, season],
    queryFn: async () => {
      if (!competitionId) return ((await supabase.from("teams").select("*").order("name")).data ?? []) as Team[];
      let linkQuery = supabase.from("competition_teams").select("team_id").eq("competition_id", competitionId);
      if (season) linkQuery = linkQuery.eq("season", season);
      const { data: links } = await linkQuery;
      const ids = (links ?? []).map((link) => link.team_id);
      const { data } = ids.length ? await supabase.from("teams").select("*").in("id", ids).order("name") : { data: [] };
      return (data ?? []) as Team[];
    },
  });
  const libraryQ = useQuery({ queryKey: ["admin", "team-library"], queryFn: async () => (await supabase.from("teams").select("*").order("name")).data as Team[] ?? [] });
  const titlesQ = useQuery({
    queryKey: ["admin", "comp-titles", competitionId],
    queryFn: async () => {
      if (!competitionId) return {} as Record<string, number>;
      const { data } = await supabase.from("competition_teams").select("team_id,titles").eq("competition_id", competitionId);
      return Object.fromEntries((data ?? []).map((r) => [r.team_id, r.titles ?? 0])) as Record<string, number>;
    },
  });

  const setTitles = async (teamId: string, titles: number) => {
    if (!competitionId) return;
    await supabase.from("competition_teams").update({ titles }).eq("competition_id", competitionId).eq("team_id", teamId);
    qc.invalidateQueries({ queryKey: ["admin", "comp-titles", competitionId] });
  };

  const save = async () => {
    if (!form.name) return;
    // A national team *is* its country, so derive the country from the name instead of asking for it.
    const base = { ...form };
    if (base.is_national) {
      const match = COUNTRIES.find((c) => c.name.toLowerCase() === (base.name ?? "").trim().toLowerCase());
      base.country = match?.name ?? null;
      base.country_code = match?.code ?? base.country_code ?? null;
    }
    const payload = competitionId ? { ...base, competition_id: competitionId } : { ...base };
    if (form.id) await supabase.from("teams").update(payload).eq("id", form.id);
    else {
      const { data } = await supabase.from("teams").insert(payload as never).select("id").single();
      if (data && competitionId) await supabase.from("competition_teams").insert({ competition_id: competitionId, team_id: data.id, season } as never);
    }
    setOpen(false); setForm({});
    qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] });
    qc.invalidateQueries({ queryKey: ["admin", "team-library"] });
  };

  /** Inside a competition the bin only unlinks the team; the club stays in the library. */
  const removeFromCompetition = async (id: string) => {
    if (!competitionId) return;
    let link = supabase.from("competition_teams").delete().eq("competition_id", competitionId).eq("team_id", id);
    if (season) link = link.eq("season", season);
    await link;
    let standings = supabase.from("standings_rows").delete().eq("competition_id", competitionId).eq("team_id", id);
    if (season) standings = standings.eq("season", season);
    await standings;
    qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] });
    qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId] });
  };

  /** Only available in the global Teams library: wipes the club from the database. */
  const deleteForever = async (id: string) => {
    await supabase.from("teams").delete().eq("id", id);
    setDeleteTeam(null);
    qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] });
    qc.invalidateQueries({ queryKey: ["admin", "team-library"] });
  };


  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">Teams</h3>
        <div className="flex flex-wrap gap-2">{competitionId && <button className={btnGhost} onClick={() => setLibraryOpen(true)}><Library className="h-3.5 w-3.5" /> Add existing</button>}<button className={btnPrimary} onClick={() => { setForm({}); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> New team</button></div>
      </div>
      <div className="grid gap-2">
        {!competitionId && (
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs">
              {(["all", "clubs", "national"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-full px-3 py-1 font-semibold capitalize ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {k === "national" ? "National teams" : k}
                </button>
              ))}
            </div>
            <input className={`${inputCls} max-w-48`} placeholder="Search teams" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
        {(q.data ?? [])
          .filter((t) => (competitionId ? true : kind === "all" || (kind === "national" ? t.is_national : !t.is_national)))
          .filter((t) => (competitionId || !search.trim() ? true : t.name.toLowerCase().includes(search.trim().toLowerCase())))
          .slice(0, competitionId ? 500 : 120)
          .map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 sm:gap-3">
            <TeamCrest name={t.name} logo={t.logo_url} />
            <div className="min-w-0 flex-1 basis-40">
              <div className="truncate font-semibold text-sm">{t.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[t.is_national ? "National team" : null, t.is_temporary ? "Temporary club" : null, t.is_national ? null : t.country, t.venue_name, `${t.trophies ?? 0} trophies`].filter(Boolean).join(" · ")}</div>
            </div>
            {competitionId && <label className="flex shrink-0 items-center gap-1 text-[0.65rem] font-semibold uppercase text-muted-foreground">
              Titles
              <input type="number" min={0} className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-base sm:text-sm"
                value={titlesQ.data?.[t.id] ?? 0}
                onChange={(e) => setTitles(t.id, Math.max(0, Number(e.target.value) || 0))} />
            </label>}
            <button className={btnGhost} onClick={() => setSquadOf(t)}>{t.is_national ? <Flag className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />} {t.is_national ? "Call-ups" : "Squad"}</button>
            <button className={btnGhost} onClick={() => setStaffOf(t)}><UserCog className="h-3.5 w-3.5" /> Coaches</button>
            <button className={btnGhost} onClick={() => { setForm(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            {competitionId
              ? <button className={btnDanger} title="Remove from this competition" onClick={() => removeFromCompetition(t.id)}><UserMinus className="h-3.5 w-3.5" /></button>
              : <button className={btnDanger} title="Delete permanently" onClick={() => setDeleteTeam(t)}><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No teams yet.</div>}
      </div>

      <ConfirmDelete
        open={!!deleteTeam}
        title={`Delete ${deleteTeam?.name ?? "team"} permanently`}
        description="This removes the club from the database everywhere, including its squad links, matches and standings rows. To only take it out of one competition, open that competition's Teams tab instead."
        confirmWord="DELETE"
        actionLabel="Delete team"
        onCancel={() => setDeleteTeam(null)}
        onConfirm={() => deleteForever(deleteTeam!.id)}
      />



      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit team" : "New team"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Short name"><input className={inputCls} value={form.short_name ?? ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></Field>
          {!form.is_national && (
            <Field label="Country">
              <CountrySelect value={form.country} onChange={(name, c) => setForm({ ...form, country: name, country_code: c?.code ?? null })} />
            </Field>
          )}
          <Field label="Home venue">
            <VenueSelect venue={form.venue_name} city={form.venue_city} onChange={(v, city) => setForm({ ...form, venue_name: v, venue_city: city })} />
          </Field>
          <Field label="Founded on"><input type="date" className={inputCls} value={form.founded_on ?? ""} onChange={(e) => setForm({ ...form, founded_on: e.target.value || null })} /></Field>
          <Field label="Total trophies"><input type="number" min={0} className={inputCls} value={form.trophies ?? 0} onChange={(e) => setForm({ ...form, trophies: Math.max(0, Number(e.target.value) || 0) })} /></Field>
           <Field label="Chairman"><input className={inputCls} value={form.chairman ?? ""} onChange={(e) => setForm({ ...form, chairman: e.target.value || null })} /></Field>
          <div className="sm:col-span-2"><Field label="Team logo">
            <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("team-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
          </Field></div>
          <div className="sm:col-span-2"><Field label="Media gallery">
            <MediaUrls urls={form.media_urls ?? []} onChange={(v) => setForm({ ...form, media_urls: v })} bucket="team-logos" />
          </Field></div>
        </div>
        <label className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!form.is_temporary} onChange={(e) => setForm({ ...form, is_temporary: e.target.checked })} />
          <span><strong className="block">Temporary club</strong>A placeholder only: no club information is kept and visitors cannot open its page.</span>
        </label>
        <label className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!form.is_national} onChange={(e) => setForm({ ...form, is_national: e.target.checked })} />
          <span><strong className="block">National team</strong>Players are called up instead of transferred, so their club never changes.</span>
        </label>
        <p className="mt-3 text-[0.65rem] text-muted-foreground">Groups are managed from the Standings tab. Coaches are added from the Coaches button.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>

      <Modal open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Add an existing team">
        <Field label="Saved team"><select className={inputCls} value={libraryTeamId} onChange={(e) => setLibraryTeamId(e.target.value)}><option value="">Choose a team</option>{(libraryQ.data ?? []).filter((team) => !(q.data ?? []).some((current) => current.id === team.id)).map((team) => <option key={team.id} value={team.id}>{team.name}{team.country ? ` · ${team.country}` : ""}</option>)}</select></Field>
        <div className="mt-4 flex justify-end gap-2"><button className={btnGhost} onClick={() => setLibraryOpen(false)}>Cancel</button><button className={btnPrimary} disabled={!libraryTeamId} onClick={async () => { await supabase.from("competition_teams").insert({ competition_id: competitionId, team_id: libraryTeamId, season } as never); setLibraryTeamId(""); setLibraryOpen(false); qc.invalidateQueries({ queryKey: ["admin", "teams", competitionId] }); qc.invalidateQueries({ queryKey: ["admin", "standings", competitionId] }); }}>Add to competition</button></div>
      </Modal>

      {squadOf && (squadOf.is_national
        ? <NationalSquadModal team={squadOf} onClose={() => setSquadOf(null)} />
        : <SquadModal team={squadOf} onClose={() => setSquadOf(null)} />)}
      {staffOf && <CoachesModal team={staffOf} onClose={() => setStaffOf(null)} />}
    </div>
  );
}

function SquadModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Player> | null>(null);
  const [addExisting, setAddExisting] = useState(false);
  const [pick, setPick] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [confirmPlayer, setConfirmPlayer] = useState<Player | null>(null);

  const key = ["admin", "players", team.id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").eq("team_id", team.id).order("shirt_number", { nullsFirst: false });
      return (data ?? []) as Player[];
    },
  });
  const pool = useQuery({
    enabled: addExisting,
    queryKey: ["admin", "player-pool", team.id],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*, team:team_id(id,name)").neq("team_id", team.id).order("name").limit(500);
      const free = await supabase.from("players").select("*, team:team_id(id,name)").is("team_id", null).order("name");
      const rows = [...(free.data ?? []), ...(data ?? [])] as unknown as (Player & { team: { id: string; name: string } | null })[];
      return rows.filter((row, index, all) => all.findIndex((r) => r.id === row.id) === index);
    },
  });
  const invalidate = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["admin", "player-pool", team.id] }); qc.invalidateQueries({ queryKey: ["admin", "all-players"] }); };

  return (
    <Modal open onClose={onClose} title={`${team.name} — squad`} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => setEditing({ team_id: team.id })}><Plus className="h-3.5 w-3.5" /> Add player</button>
        <button className={btnGhost} onClick={() => setAddExisting(true)}><Library className="h-3.5 w-3.5" /> Add existing player</button>
      </div>

      {addExisting && (
        <div className="mb-4 rounded-2xl border border-border bg-background/50 p-3">
          <Field label="Search free agents and players at other clubs">
            <input autoFocus className={inputCls} placeholder="Type a player name" value={poolSearch} onChange={(e) => { setPoolSearch(e.target.value); setPick(""); }} />
          </Field>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {(pool.data ?? [])
              .filter((p) => p.name.toLowerCase().includes(poolSearch.trim().toLowerCase()))
              .slice(0, 60)
              .map((p) => (
                <button key={p.id} type="button" onClick={() => setPick(p.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border p-2 text-start ${pick === p.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}>
                  <PlayerAvatar src={p.photo_url} name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-[0.65rem] text-muted-foreground">{[p.team ? p.team.name : "Free agent", p.position, p.nationality].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              ))}
            {(pool.data ?? []).filter((p) => p.name.toLowerCase().includes(poolSearch.trim().toLowerCase())).length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{pool.isLoading ? "Loading players…" : "No player matches that name"}</div>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => { setAddExisting(false); setPick(""); setPoolSearch(""); }}>Cancel</button>
            <button className={btnPrimary} disabled={!pick} onClick={async () => {
              const player = (pool.data ?? []).find((p) => p.id === pick);
              if (!player) return;
              await transferPlayerToClub({ id: player.id }, player.team?.name ?? null, team.id, team.name);
              setPick(""); setPoolSearch(""); setAddExisting(false); invalidate();
            }}>Sign player</button>
          </div>
        </div>
      )}

      <div className="grid gap-5">
        {POSITIONS.map((position) => {
          const players = (q.data ?? []).filter((player) => (player.position ?? "Unknown") === position);
          if (position === "Unknown" && players.length === 0) return null;
          return (
            <section key={position}>
              <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{position}</h4>
              <div className="grid gap-2">
                {players.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                    <PlayerAvatar src={p.photo_url} name={p.name} />
                    <div className="min-w-0 flex-1 basis-32">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-[0.65rem] text-muted-foreground">{[p.position, p.nationality, p.shirt_number ? `#${p.shirt_number}` : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <button className={btnGhost} onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /> Edit</button>
                    <button className={btnGhost} onClick={async () => { if (!confirm(`Release ${p.name} to free agents?`)) return; await releasePlayerToFreeAgent(p, team.name); invalidate(); }}><UserMinus className="h-3 w-3" /> Release</button>
                    <button className={btnDanger} onClick={() => setConfirmPlayer(p)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
                {players.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No {position.toLowerCase()}s</div>}
              </div>
            </section>
          );
        })}
      </div>

      {editing && <PlayerEditor player={editing} teamId={team.id} teamName={team.name} onClose={() => { setEditing(null); invalidate(); }} />}
      <ConfirmDelete
        open={!!confirmPlayer}
        title={`Delete ${confirmPlayer?.name ?? ""}`}
        description="This permanently removes the player from the database, including their squad entry and history. This cannot be undone."
        confirmWord="DELETE"
        actionLabel="Delete player"
        onCancel={() => setConfirmPlayer(null)}
        onConfirm={async () => { await deletePlayerForever(confirmPlayer!.id); setConfirmPlayer(null); invalidate(); }}
      />
    </Modal>
  );
}

function CoachesModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CoachForm>({});
  const [editing, setEditing] = useState(false);
  const key = ["admin", "coaches", team.id];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("coaches").select("*").eq("team_id", team.id).order("created_at");
      return (data ?? []) as Coach[];
    },
  });

  const save = async () => {
    if (!form.name) return;
    const payload = { ...form, team_id: team.id };
    if (form.id) await supabase.from("coaches").update(payload).eq("id", form.id);
    else {
      const { data } = await supabase.from("coaches").insert(payload as never).select("*").maybeSingle();
      if (data) setForm(data as Coach);
    }
    qc.invalidateQueries({ queryKey: key });
    if (form.id) { setForm({}); setEditing(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove coach?")) return;
    await supabase.from("coaches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Modal open onClose={onClose} title={`${team.name} — coaches`} wide>
      <div className="mb-4 grid gap-2">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {c.photo_url ? <img src={c.photo_url} alt="" className="h-full w-full object-cover" /> : <UserCog className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-[0.65rem] text-muted-foreground">{[c.nationality, c.dob].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => { setForm(c); setEditing(true); }}><Pencil className="h-3 w-3" /></button>
            <button className={btnDanger} onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No coaches yet.</div>}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Nationality">
              <CountrySelect value={form.nationality} onChange={(name, c) => setForm({ ...form, nationality: name, nationality_code: c?.code ?? null })} />
            </Field>
            <Field label="Date of birth"><DateWheel value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} /></Field>
            <Field label="Birth place"><input className={inputCls} value={form.birth_place ?? ""} onChange={(e) => setForm({ ...form, birth_place: e.target.value || null })} /></Field>
            <Field label="Appointed on"><input type="date" className={inputCls} value={form.appointed_on ?? ""} onChange={(e) => setForm({ ...form, appointed_on: e.target.value || null })} /></Field>
            <Field label="Contract until"><input type="date" className={inputCls} value={form.contract_until ?? ""} onChange={(e) => setForm({ ...form, contract_until: e.target.value || null })} /></Field>
            <Field label="Trophies"><input type="number" min={0} className={inputCls} value={form.trophies ?? 0} onChange={(e) => setForm({ ...form, trophies: Math.max(0, Number(e.target.value) || 0) })} /></Field>
            <Field label="Photo">
              <ImageInput value={form.photo_url ?? null} onChange={(v) => setForm({ ...form, photo_url: v })} onFile={async (f) => { const url = await uploadMedia("team-logos", f); if (url) setForm({ ...form, photo_url: url }); }} />
            </Field>
            <div className="sm:col-span-2"><Field label="Biography"><textarea rows={3} className={inputCls} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value || null })} /></Field></div>
          </div>
          {form.id && <div className="mt-4"><TransfersEditor personType="coach" personId={form.id} /></div>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => { setEditing(false); setForm({}); }}>Cancel</button>
            <button className={btnPrimary} onClick={save}>{form.id ? "Save coach" : "Create coach"}</button>
          </div>
        </div>
      ) : (
        <button className={btnPrimary} onClick={() => { setForm({}); setEditing(true); }}><Plus className="h-3.5 w-3.5" /> Add coach</button>
      )}
    </Modal>
  );
}