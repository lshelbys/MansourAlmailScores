import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase, STATUS_LABELS, matchClockSeconds, formatClock,
  eventIcon, ratingClass,
  type Match, type Team, type Player, type MatchEvent, type Lineup,
} from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { VenueSelect } from "./venue-select";
import { Play, Pause, Plus, Trash2, RotateCcw, Check, Info, ListChecks, Radio, BarChart3 } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { MediaManager } from "./media-manager";
import { fetchCallUps, applyCallUp } from "@/lib/national";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type MatchStat = Database["public"]["Tables"]["match_stats"]["Row"];
type Channel = Database["public"]["Tables"]["broadcast_channels"]["Row"];

export const EVENT_TYPES = [
  { v: "goal", l: "Goal" },
  { v: "penalty_goal", l: "Penalty goal" },
  { v: "own_goal", l: "Own goal" },
  { v: "penalty_miss", l: "Penalty missed" },
  { v: "yellow", l: "Yellow card" },
  { v: "second_yellow", l: "Second yellow" },
  { v: "red", l: "Red card" },
  { v: "substitution", l: "Substitution" },
  { v: "var", l: "VAR" },
  { v: "note", l: "Note" },
];

const GOAL_KINDS = [
  { v: "goal", l: "Normal goal" },
  { v: "penalty_goal", l: "Penalty" },
  { v: "own_goal", l: "Own goal" },
];

function useLiveClock(match: Match) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!match.timer_running) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [match.timer_running]);
  return matchClockSeconds(match);
}

export function MatchEditor({ match: initial, teams, onClose }: { match: Match; teams: Team[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"main" | "lineups" | "live" | "extras">("main");

  const matchQ = useQuery({
    queryKey: ["admin", "match", initial.id],
    initialData: initial,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("id", initial.id).maybeSingle();
      return (data ?? initial) as Match;
    },
  });
  const match = matchQ.data;
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "TBD";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "match", initial.id] });
    qc.invalidateQueries({ queryKey: ["admin", "matches", initial.competition_id] });
  };

  return (
    <Modal open onClose={onClose} title="Manage match" wide fullPage>
      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border bg-background p-4">
        <TeamSummary team={teams.find((team) => team.id === match.home_team_id)} />
        <div className="text-center"><div className="text-xl font-black tabular-nums">{match.home_score ?? 0} – {match.away_score ?? 0}</div><div className="mt-1 text-[0.65rem] font-semibold uppercase text-muted-foreground">{STATUS_LABELS[match.status] ?? match.status}</div></div>
        <TeamSummary team={teams.find((team) => team.id === match.away_team_id)} away />
      </div>
      <div className="mb-6 grid grid-cols-4 gap-1 rounded-lg border border-border bg-background p-1 text-[0.65rem] sm:text-xs">
        {([["main", "Info", Info], ["lineups", "Lineups", ListChecks], ["live", "Live", Radio], ["extras", "Post-match", BarChart3]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-2 font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="h-4 w-4" />{l}</button>
        ))}
      </div>
      {tab === "main" && <MainTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "lineups" && <LineupsTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "live" && <LiveTab match={match} teams={teams} onSaved={refresh} />}
      {tab === "extras" && <ExtrasTab match={match} teams={teams} />}
    </Modal>
  );
}

function TeamSummary({ team, away = false }: { team: Team | undefined; away?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2 ${away ? "flex-row-reverse text-end" : ""}`}><TeamCrest name={team?.name} logo={team?.logo_url} className="h-10 w-10" /><span className="truncate text-xs font-bold sm:text-sm">{team?.name ?? "TBD"}</span></div>;
}

function ExtrasTab({ match, teams }: { match: Match; teams: Team[] }) {
  const qc = useQueryClient();
  const channelsQ = useQuery({ queryKey: ["admin", "channels"], queryFn: async () => (await supabase.from("broadcast_channels").select("*").order("name")).data as Channel[] ?? [] });
  const selectedQ = useQuery({ queryKey: ["admin", "match-channels", match.id], queryFn: async () => (await supabase.from("match_broadcasts").select("channel_id").eq("match_id", match.id)).data ?? [] });
  const selected = new Set((selectedQ.data ?? []).map((item) => item.channel_id));
  void teams;
  return <div className="space-y-8">
    <section><h4 className="mb-3 font-bold">Where to watch</h4><div className="flex flex-wrap gap-2">{channelsQ.data?.map((channel) => <button key={channel.id} onClick={async () => { if (selected.has(channel.id)) await supabase.from("match_broadcasts").delete().eq("match_id", match.id).eq("channel_id", channel.id); else await supabase.from("match_broadcasts").insert({ match_id: match.id, channel_id: channel.id } as never); qc.invalidateQueries({ queryKey: ["admin", "match-channels", match.id] }); }} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${selected.has(channel.id) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{channel.logo_url && <img src={channel.logo_url} alt="" className="h-5 w-5 object-contain" />}{channel.name}</button>)}</div>{channelsQ.data?.length === 0 && <p className="text-xs text-muted-foreground">Create channels from the main Admin → Channels section first.</p>}</section>
    <section><h4 className="mb-3 font-bold">Videos and media</h4><MediaManager ownerType="match" ownerId={match.id} /></section>
  </div>;
}

/* ---------------- Match statistics (pick, don't type) ---------------- */

const STAT_PRESETS: { label: string; max: number; suffix?: string; step?: number }[] = [
  { label: "Ball possession", max: 100, suffix: "%" },
  { label: "Total shots", max: 40 },
  { label: "Shots on target", max: 30 },
  { label: "Corner kicks", max: 25 },
  { label: "Offsides", max: 15 },
  { label: "Fouls", max: 40 },
  { label: "Yellow cards", max: 10 },
  { label: "Red cards", max: 5 },
  { label: "Saves", max: 20 },
  { label: "Passes", max: 900, step: 5 },
  { label: "Pass accuracy", max: 100, suffix: "%" },
  { label: "Tackles", max: 50 },
];

function NumberPicker({ value, onChange, max, step = 1, suffix }: { value: string; onChange: (v: string) => void; max: number; step?: number; suffix?: string }) {
  const options: number[] = [];
  for (let n = 0; n <= max; n += step) options.push(n);
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((n) => <option key={n} value={suffix ? `${n}${suffix}` : String(n)}>{n}{suffix ?? ""}</option>)}
    </select>
  );
}

function MatchStatsEditor({ match, teams }: { match: Match; teams: Team[] }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(STAT_PRESETS[0].label);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const preset = STAT_PRESETS.find((p) => p.label === label) ?? STAT_PRESETS[0];
  const statsQ = useQuery({ queryKey: ["admin", "match-stats", match.id], queryFn: async () => (await supabase.from("match_stats").select("*").eq("match_id", match.id).order("sort_order")).data as MatchStat[] ?? [] });
  const homeName = teams.find((team) => team.id === match.home_team_id)?.name ?? "Home";
  const awayName = teams.find((team) => team.id === match.away_team_id)?.name ?? "Away";
  const add = async () => {
    if (!label || (home === "" && away === "")) return;
    const existing = statsQ.data?.find((s) => s.label === label);
    if (existing) await supabase.from("match_stats").update({ home_value: home, away_value: away }).eq("id", existing.id);
    else await supabase.from("match_stats").insert({ label, home_value: home, away_value: away, match_id: match.id, sort_order: statsQ.data?.length ?? 0 } as never);
    setHome(""); setAway("");
    qc.invalidateQueries({ queryKey: ["admin", "match-stats", match.id] });
  };
  return (
    <section className="mt-5 rounded-lg border border-border bg-background/40 p-3">
      <h4 className="mb-3 text-sm font-bold">Match statistics</h4>
      <div className="grid gap-2">
        {statsQ.data?.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr_auto] items-center gap-2 rounded-lg border border-border p-2 text-sm">
            <span className="text-center font-bold">{item.home_value}</span>
            <span className="text-center text-muted-foreground">{item.label}</span>
            <span className="text-center font-bold">{item.away_value}</span>
            <button className="text-destructive" onClick={async () => { await supabase.from("match_stats").delete().eq("id", item.id); qc.invalidateQueries({ queryKey: ["admin", "match-stats", match.id] }); }}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <Field label="Statistic">
          <select className={inputCls} value={label} onChange={(e) => { setLabel(e.target.value); setHome(""); setAway(""); }}>
            {STAT_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </Field>
        <Field label={homeName}><NumberPicker value={home} onChange={setHome} max={preset.max} step={preset.step} suffix={preset.suffix} /></Field>
        <Field label={awayName}><NumberPicker value={away} onChange={setAway} max={preset.max} step={preset.step} suffix={preset.suffix} /></Field>
        <div className="flex items-end"><button className={btnPrimary} onClick={add}><Plus className="h-4 w-4" /> Save stat</button></div>
      </div>
    </section>
  );
}

/* ---------------- Main ---------------- */

function MainTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Match>>(match);
  useEffect(() => setForm(match), [match.id]);

  const save = async () => {
    await supabase.from("matches").update({
      home_team_id: form.home_team_id ?? null,
      away_team_id: form.away_team_id ?? null,
      kickoff_at: form.kickoff_at ?? null,
      round_number: form.round_number ?? null,
      round: form.round_number != null ? `Round ${form.round_number}` : null,
      venue: form.venue ?? null,
      city: form.city ?? null,
      referee: form.referee ?? null,
      highlight_url: form.highlight_url ?? null,
      notes: form.notes ?? null,
      status: form.status ?? "scheduled",
      timer_running: ["live", "ht"].includes(form.status ?? "") ? form.timer_running ?? false : false,
      timer_started_at: ["live", "ht"].includes(form.status ?? "") ? form.timer_started_at ?? null : null,
    }).eq("id", match.id);
    onSaved();
  };

  const local = form.kickoff_at ? new Date(new Date(form.kickoff_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-background/40 p-4">
        <div className="mb-4"><h3 className="font-bold">Match information</h3><p className="text-xs text-muted-foreground">Schedule the fixture and set its basic presentation.</p></div>
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
          <input type="datetime-local" className={inputCls} value={local}
            onChange={(e) => setForm({ ...form, kickoff_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </Field>
        <Field label="Round number"><input type="number" min={1} inputMode="numeric" className={inputCls} placeholder="1" value={form.round_number ?? ""} onChange={(e) => setForm({ ...form, round_number: e.target.value ? Number(e.target.value) : null })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Venue"><VenueSelect venue={form.venue} city={form.city} onChange={(v, c) => setForm({ ...form, venue: v, city: c })} /></Field>
        </div>
        <Field label="Referee"><input className={inputCls} value={form.referee ?? ""} onChange={(e) => setForm({ ...form, referee: e.target.value })} /></Field>
        <Field label="Highlights link"><input className={inputCls} placeholder="YouTube link" value={form.highlight_url ?? ""} onChange={(e) => setForm({ ...form, highlight_url: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Notes"><textarea rows={2} className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end"><button className={btnPrimary} onClick={save}>Save details</button></div>
      </section>
      <section className="rounded-lg border border-border bg-background/40 p-4">
        <h3 className="font-bold">Match status</h3>
        <p className="mt-1 text-xs text-muted-foreground">Use the Live tab to run the clock and add events. Choose a final or interrupted state there when play ends.</p>
        <div className="mt-3 flex flex-wrap gap-2">{["scheduled", "postponed", "cancelled", "interrupted", "awarded"].map((status) => <button key={status} type="button" onClick={() => setForm({ ...form, status, timer_running: false })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${form.status === status ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{STATUS_LABELS[status]}</button>)}</div>
      </section>
    </div>
  );
}

/** Score-only entry: set a final result without running the clock or logging events. */
function ResultOnly({ match }: { match: Match }) {
  const qc = useQueryClient();
  const [home, setHome] = useState(String(match.home_score ?? ""));
  const [away, setAway] = useState(String(match.away_score ?? ""));
  const [status, setStatus] = useState(match.status === "scheduled" ? "ft" : match.status);
  useEffect(() => { setHome(String(match.home_score ?? "")); setAway(String(match.away_score ?? "")); }, [match.id]);
  const save = async () => {
    await supabase.from("matches").update({
      home_score: home === "" ? null : Number(home),
      away_score: away === "" ? null : Number(away),
      status, timer_running: false, timer_started_at: null,
    }).eq("id", match.id);
    qc.invalidateQueries({ queryKey: ["admin", "match", match.id] });
    qc.invalidateQueries({ queryKey: ["admin", "matches", match.competition_id] });
  };
  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <h3 className="font-bold">Match result only</h3>
      <p className="mt-1 text-xs text-muted-foreground">Use this for awarded or archived matches — just type the score, no minutes or events needed.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="number" inputMode="numeric" className="h-11 w-20 rounded-lg border border-border bg-background text-center text-lg font-black" value={home} onChange={(e) => setHome(e.target.value)} />
        <span className="text-lg font-black">–</span>
        <input type="number" inputMode="numeric" className="h-11 w-20 rounded-lg border border-border bg-background text-center text-lg font-black" value={away} onChange={(e) => setAway(e.target.value)} />
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["ft", "aet", "pen", "awarded"].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button className={btnPrimary} onClick={save}>Save result</button>
      </div>
    </section>
  );
}

/* ---------------- Lineups ---------------- */

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1", "4-5-1"];

/** Slot keys for a formation, goalkeeper first then each outfield line. */
function formationSlots(formation: string | null | undefined): string[] {
  const lines = (formation ?? "4-3-3").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const slots = ["GK"];
  lines.forEach((count, li) => {
    for (let i = 0; i < count; i++) slots.push(`L${li + 1}-${i + 1}`);
  });
  return slots;
}

function formationRows(formation: string | null | undefined): string[][] {
  const slots = formationSlots(formation);
  const lines = (formation ?? "4-3-3").split("-").map((n) => Number(n)).filter((n) => n > 0);
  const rows: string[][] = [["GK"]];
  let idx = 1;
  for (const count of lines) {
    rows.push(slots.slice(idx, idx + count));
    idx += count;
  }
  return rows.reverse();
}

/** Per-player match ratings for the starting eleven and any substitute who came on. */
function RatingsEditor({ match, lineups, players }: { match: Match; lineups: Lineup[]; players: Player[] }) {
  const qc = useQueryClient();
  const ratingsQ = useQuery({
    queryKey: ["admin", "match-ratings", match.id],
    queryFn: async () => (await supabase.from("player_ratings").select("*").eq("match_id", match.id)).data ?? [],
  });
  const eventsQ = useQuery({
    queryKey: ["admin", "events", match.id],
    queryFn: async () => (await supabase.from("match_events").select("*").eq("match_id", match.id)).data as MatchEvent[] ?? [],
  });
  const save = async (playerId: string, value: string) => {
    const existing = ratingsQ.data?.find((r) => r.player_id === playerId);
    if (value === "") {
      if (existing) await supabase.from("player_ratings").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("player_ratings").update({ rating: Number(value) }).eq("id", existing.id);
    } else {
      await supabase.from("player_ratings").insert({ match_id: match.id, player_id: playerId, competition_id: match.competition_id, rating: Number(value) } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "match-ratings", match.id] });
  };
  if (lineups.length === 0) return null;
  const cameOn = new Set((eventsQ.data ?? []).filter((e) => e.type === "substitution" && e.player_id).map((e) => e.player_id as string));
  const rated = lineups.filter((lu) => lu.is_starting || cameOn.has(lu.player_id));
  if (rated.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-background/40 p-3">
      <h4 className="mb-2 text-sm font-bold">Player ratings</h4>
      <p className="mb-2 text-[0.65rem] text-muted-foreground">Starting eleven and substitutes who came on.</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {rated.map((lu) => {
          const player = players.find((p) => p.id === lu.player_id);
          const rating = ratingsQ.data?.find((r) => r.player_id === lu.player_id)?.rating;
          return (
            <div key={lu.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{player?.name ?? "—"}</span>
              {rating != null && <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-black ${ratingClass(Number(rating))}`}>{rating}</span>}
              <input type="number" step="0.1" min={0} max={10} defaultValue={rating ?? ""} onChange={(e) => save(lu.player_id, e.target.value)} onBlur={(e) => save(lu.player_id, e.target.value)}
                className="h-8 w-16 rounded border border-border bg-background text-center" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LineupsTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const qc = useQueryClient();
  const [picker, setPicker] = useState<{ teamId: string; slot: string } | null>(null);
  const [benchPicker, setBenchPicker] = useState<string | null>(null);
  const [clearTeam, setClearTeam] = useState<string | null>(null);
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];

  const playersQ = useQuery({
    enabled: teamIds.length > 0,
    queryKey: ["admin", "players-of-match", match.id, teamIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").in("team_id", teamIds);
      const clubPlayers = (data ?? []) as Player[];
      // national teams pick from call-ups, so the player keeps his club but plays under the national shirt
      const nationalIds = teamIds.filter((id) => teams.find((t) => t.id === id)?.is_national);
      if (nationalIds.length === 0) return clubPlayers;
      const calls = await fetchCallUps(nationalIds);
      const { data: called } = calls.length
        ? await supabase.from("players").select("*").in("id", calls.map((c) => c.player_id))
        : { data: [] as Player[] };
      const nationals = calls.flatMap((call) => {
        const player = (called ?? []).find((p) => p.id === call.player_id) as Player | undefined;
        return player ? [{ ...applyCallUp(player, call), team_id: call.team_id }] : [];
      });
      return [...clubPlayers.filter((p) => !nationalIds.includes(p.team_id ?? "")), ...nationals] as Player[];
    },
  });
  const lineupsQ = useQuery({
    queryKey: ["admin", "lineups", match.id],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups").select("*").eq("match_id", match.id);
      return (data ?? []) as Lineup[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ["admin", "events", match.id],
    queryFn: async () => (await supabase.from("match_events").select("*").eq("match_id", match.id)).data as MatchEvent[] ?? [],
  });
  const ratingsQ = useQuery({
    queryKey: ["admin", "match-ratings", match.id],
    queryFn: async () => (await supabase.from("player_ratings").select("*").eq("match_id", match.id)).data ?? [],
  });

  const players = playersQ.data ?? [];
  const lineups = lineupsQ.data ?? [];
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";

  /** Icons a player earned in this match: goals, cards, and a swap arrow when subbed off/on. */
  const iconsFor = (playerId: string) => (eventsQ.data ?? []).flatMap((e) => {
    if (e.sub_out_player_id === playerId) return [eventIcon("substitution")];
    if (e.player_id !== playerId) return [];
    return [eventIcon(e.type)];
  });
  const ratingFor = (playerId: string) => (ratingsQ.data ?? []).find((r) => r.player_id === playerId)?.rating ?? null;

  // Formation pitch is the only lineup layout; 4-3-3 is the starting shape.
  useEffect(() => {
    if (match.lineup_mode === "formation" && match.home_formation && match.away_formation) return;
    supabase.from("matches").update({
      lineup_mode: "formation",
      home_formation: match.home_formation ?? "4-3-3",
      away_formation: match.away_formation ?? "4-3-3",
    }).eq("id", match.id).then(onSaved);
  }, [match.id, match.lineup_mode, match.home_formation, match.away_formation]);

  const setFormation = async (side: "home" | "away", v: string) => {
    await supabase.from("matches").update(side === "home" ? { home_formation: v } : { away_formation: v }).eq("id", match.id);
    onSaved();
  };

  const toggle = async (playerId: string, teamId: string, starting: boolean) => {
    const existing = lineups.find((l) => l.player_id === playerId);
    if (existing) {
      if (existing.is_starting === starting) await supabase.from("match_lineups").delete().eq("id", existing.id);
      else await supabase.from("match_lineups").update({ is_starting: starting }).eq("id", existing.id);
    } else {
      await supabase.from("match_lineups").insert({ match_id: match.id, team_id: teamId, player_id: playerId, is_starting: starting } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const assignSlot = async (teamId: string, slot: string, playerId: string | null) => {
    const current = lineups.find((l) => l.team_id === teamId && l.position_code === slot);
    if (current) await supabase.from("match_lineups").delete().eq("id", current.id);
    if (playerId) {
      const dupe = lineups.find((l) => l.player_id === playerId);
      if (dupe) await supabase.from("match_lineups").delete().eq("id", dupe.id);
      const p = players.find((x) => x.id === playerId);
      await supabase.from("match_lineups").insert({
        match_id: match.id, team_id: teamId, player_id: playerId,
        is_starting: true, position_code: slot, shirt_number: p?.shirt_number ?? null,
      } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const publish = async (value: boolean) => {
    await supabase.from("matches").update({ lineups_published: value }).eq("id", match.id);
    onSaved();
  };

  const clearAll = async (teamId: string) => {
    await supabase.from("match_lineups").delete().eq("match_id", match.id).eq("team_id", teamId);
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  const setMatchNumber = async (lineupId: string, value: string) => {
    const n = value.trim() === "" ? null : Number(value);
    await supabase.from("match_lineups").update({ shirt_number: Number.isFinite(n as number) ? n : null }).eq("id", lineupId);
    qc.invalidateQueries({ queryKey: ["admin", "lineups", match.id] });
  };

  /** Save (or clear) a player's rating for this match — used by the card tap editor. */
  const saveRating = async (playerId: string, value: string) => {
    const existing = (ratingsQ.data ?? []).find((r) => r.player_id === playerId);
    if (value.trim() === "") {
      if (existing) await supabase.from("player_ratings").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("player_ratings").update({ rating: Number(value) }).eq("id", existing.id);
    } else {
      await supabase.from("player_ratings").insert({ match_id: match.id, player_id: playerId, competition_id: match.competition_id, rating: Number(value) } as never);
    }
    qc.invalidateQueries({ queryKey: ["admin", "match-ratings", match.id] });
  };

  return (
    <div className="space-y-4">
      <div><h3 className="font-bold">Lineups</h3><p className="text-xs text-muted-foreground">Tap a + on the pitch and pick the player — he takes that position straight away. Ratings and event icons appear on his card automatically.</p></div>

      <div className="grid gap-4 md:grid-cols-2">
        {teamIds.map((tid, i) => {
          const side = i === 0 ? "home" : "away";
          const formation = (side === "home" ? match.home_formation : match.away_formation) ?? "4-3-3";
          const squad = players.filter((p) => p.team_id === tid).sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || a.name.localeCompare(b.name));
          const bench = lineups.filter((l) => l.team_id === tid && !l.is_starting);
          return (
            <div key={tid} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-xs font-semibold">{teamName(tid)}</div>
                <div className="flex items-center gap-1">
                <select className="rounded border border-border bg-background px-2 py-1 text-xs" value={formation} onChange={(e) => setFormation(side as "home" | "away", e.target.value)}>
                  {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button type="button" onClick={() => setClearTeam(tid)} className="rounded border border-border px-2 py-1 text-[0.6rem] font-semibold text-destructive hover:bg-accent">Clear all</button>
                </div>
              </div>
              <div className="rounded-lg bg-emerald-900/25 p-2 pt-4">
                {formationRows(formation).map((row, ri) => (
                  <div key={ri} className="mb-3 flex justify-around gap-1">
                    {row.map((slot) => {
                      const assigned = lineups.find((l) => l.team_id === tid && l.position_code === slot);
                      const p = players.find((x) => x.id === assigned?.player_id);
                      const rating = p ? ratingFor(p.id) : null;
                      const icons = p ? iconsFor(p.id) : [];
                      const kit = assigned?.shirt_number ?? p?.shirt_number ?? null;
                      return (
                        <button key={slot} type="button" onClick={() => setPicker({ teamId: tid, slot })}
                          className="flex w-16 flex-col items-center gap-1 pt-1 text-center">
                          <span className="relative block overflow-visible">
                            {p ? <PlayerAvatar src={p.photo_url} name={p.name} size="sm" className="h-10 w-10" />
                              : <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-emerald-300/60 bg-background/70"><Plus className="h-4 w-4 text-emerald-200" /></span>}
                            {kit != null && <span className="absolute -left-1 -top-1 rounded-full bg-primary px-1.5 text-[0.55rem] font-black text-primary-foreground ring-2 ring-background">{kit}</span>}
                            {icons.length > 0 && <span className="absolute -right-2 -top-1 flex gap-0.5 rounded-full bg-background px-1 text-[0.6rem] leading-tight ring-2 ring-background">{icons.slice(0, 3).map((ic, k) => <span key={k}>{ic}</span>)}</span>}
                            {rating != null && <span className={`absolute -bottom-1 -right-2 rounded-md px-1 text-[0.55rem] font-black shadow ring-2 ring-background ${ratingClass(Number(rating))}`}>{Number(rating).toFixed(1)}</span>}
                          </span>
                          <span className="line-clamp-2 text-[0.55rem] font-semibold leading-tight text-foreground">{p ? p.name : slot === "GK" ? "Goalkeeper" : "Add player"}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div className="mt-1 text-center text-[0.6rem] text-muted-foreground">{formation}</div>
                {squad.length === 0 && <div className="text-center text-[0.6rem] text-muted-foreground">Add players to this squad first.</div>}
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Bench</h4>
                  <button type="button" onClick={() => setBenchPicker(tid)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border hover:bg-accent" aria-label="Pick bench players"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {bench.map((l) => {
                    const p = players.find((x) => x.id === l.player_id);
                    const icons = p ? iconsFor(p.id) : [];
                    const rating = p ? ratingFor(p.id) : null;
                    return (
                      <div key={l.id} className="flex flex-col items-center gap-1 text-center">
                        <span className="relative block">
                          <PlayerAvatar src={p?.photo_url} name={p?.name ?? "?"} size="sm" className="h-10 w-10" />
                          {(l.shirt_number ?? p?.shirt_number) != null && <span className="absolute -left-1 -top-1 rounded-full bg-muted px-1.5 text-[0.55rem] font-black ring-2 ring-background">{l.shirt_number ?? p?.shirt_number}</span>}
                          {icons.length > 0 && <span className="absolute -right-2 -top-1 flex gap-0.5 rounded-full bg-background px-1 text-[0.6rem] leading-tight ring-2 ring-background">{icons.slice(0, 3).map((ic, k) => <span key={k}>{ic}</span>)}</span>}
                          {rating != null && <span className={`absolute -bottom-1 -right-2 rounded-md px-1 text-[0.55rem] font-black shadow ring-2 ring-background ${ratingClass(Number(rating))}`}>{Number(rating).toFixed(1)}</span>}
                        </span>
                        <span className="line-clamp-2 text-[0.55rem] font-semibold leading-tight">{p?.name ?? "—"}</span>
                        <button onClick={() => toggle(l.player_id, tid, false)} className="text-destructive" aria-label="Remove from bench"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    );
                  })}
                </div>
                {bench.length === 0 && <p className="text-[0.6rem] text-muted-foreground">No bench yet — tap + to pick from the squad.</p>}
              </div>

              {(() => {
                const rows = lineups.filter((l) => l.team_id === tid);
                if (rows.length === 0) return null;
                return (
                  <div className="mt-3 rounded-lg border border-border p-2">
                    <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Kit numbers (this match only)</h4>
                    <div className="space-y-1">
                      {rows.map((l) => {
                        const p = players.find((x) => x.id === l.player_id);
                        return (
                          <div key={l.id} className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs">{p?.name ?? "—"}</span>
                            <input type="number" min={0} max={99} defaultValue={l.shirt_number ?? ""} placeholder={String(p?.shirt_number ?? "")}
                              onBlur={(e) => setMatchNumber(l.id, e.target.value)}
                              className="w-16 rounded border border-border bg-background px-2 py-1 text-xs" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        {teamIds.length === 0 && <div className="text-xs text-muted-foreground">Pick both teams in Match details first.</div>}
      </div>

      <RatingsEditor match={match} lineups={lineups} players={players} />

      <Modal open={!!benchPicker} onClose={() => setBenchPicker(null)} title="Pick bench players">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {benchPicker && ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"].map((position) => {
            const pool = players.filter((p) => p.team_id === benchPicker && (p.position ?? "Unknown") === position && !lineups.some((l) => l.player_id === p.id && l.is_starting))
              .sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || a.name.localeCompare(b.name));
            if (pool.length === 0) return null;
            return (
              <section key={position}>
                <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{position}</h4>
                <div className="grid gap-2">
                  {pool.map((player) => {
                    const benched = lineups.some((l) => l.player_id === player.id && !l.is_starting);
                    return (
                      <button key={player.id} type="button" onClick={() => toggle(player.id, benchPicker, false)}
                        className={`flex items-center gap-3 rounded-lg border p-2 text-left ${benched ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                        <PlayerAvatar src={player.photo_url} name={player.name} size="sm" />
                        <span className="w-8 text-center text-sm font-bold">{player.shirt_number ?? "—"}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{player.name}</span><span className="block text-xs text-muted-foreground">{player.position ?? "Unknown"}</span></span>
                        {benched && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => setBenchPicker(null)}><Check className="h-3.5 w-3.5" /> Done</button>
        </div>
      </Modal>

      <Modal open={!!picker} onClose={() => setPicker(null)} title="Choose player">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {picker && lineups.some((l) => l.team_id === picker.teamId && l.position_code === picker.slot) && (
            <button type="button" className={`${btnDanger} w-full`} onClick={async () => { await assignSlot(picker.teamId, picker.slot, null); setPicker(null); }}>Clear position</button>
          )}
          {(() => {
            if (!picker) return null;
            const assigned = lineups.find((l) => l.team_id === picker.teamId && l.position_code === picker.slot);
            const p = players.find((x) => x.id === assigned?.player_id);
            if (!p) return null;
            return (
              <section className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center gap-3">
                  <PlayerAvatar src={p.photo_url} name={p.name} size="sm" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{p.name}</div><div className="text-[0.65rem] text-muted-foreground">Match rating</div></div>
                  <input type="number" step="0.1" min={0} max={10} defaultValue={ratingFor(p.id) ?? ""} placeholder="—"
                    onBlur={(e) => saveRating(p.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="h-9 w-20 rounded-lg border border-border bg-background text-center text-sm font-bold" />
                </div>
                <p className="mt-2 text-[0.6rem] text-muted-foreground">Type a rating out of 10 — it shows on his card. Pick another player below to replace him.</p>
              </section>
            );
          })()}
          {picker && ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unknown"].map((position) => {
            const pool = players.filter((player) => player.team_id === picker.teamId && (player.position ?? "Unknown") === position).sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || a.name.localeCompare(b.name));
            if (pool.length === 0) return null;
            return <section key={position}><h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">{position}</h4><div className="grid gap-2">{pool.map((player) => <button key={player.id} type="button" onClick={async () => { await assignSlot(picker.teamId, picker.slot, player.id); setPicker(null); }} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2 text-left hover:border-primary"><PlayerAvatar src={player.photo_url} name={player.name} size="sm" /><span className="w-8 text-center text-sm font-bold">{player.shirt_number ?? "—"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{player.name}</span><span className="block text-xs text-muted-foreground">{player.position ?? "Unknown"}</span></span></button>)}</div></section>;
          })}
        </div>
      </Modal>

      <ConfirmDelete
        open={!!clearTeam}
        title="Clear the whole lineup?"
        description={clearTeam ? `This removes every starter and bench player for ${teamName(clearTeam)} in this match.` : undefined}
        confirmWord="CLEAR"
        actionLabel="Clear lineup"
        onCancel={() => setClearTeam(null)}
        onConfirm={async () => { if (clearTeam) await clearAll(clearTeam); setClearTeam(null); }}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/40 p-3">
        <span className="text-xs text-muted-foreground">
          {match.lineups_published ? "Lineups are live on the match page." : "Lineups stay hidden until you confirm them."}
        </span>
        {match.lineups_published
          ? <button className={btnGhost} onClick={() => publish(false)}>Unpublish</button>
          : <button className={btnPrimary} onClick={() => publish(true)}><Check className="h-3.5 w-3.5" /> Confirm lineups</button>}
      </div>
    </div>
  );
}

/* ---------------- Live ---------------- */

function LiveTab({ match, teams, onSaved }: { match: Match; teams: Team[]; onSaved: () => void }) {
  const qc = useQueryClient();
  const seconds = useLiveClock(match);
  const minute = Math.floor(seconds / 60) + (seconds % 60 > 0 ? 1 : 0);
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];

  const eventsQ = useQuery({
    queryKey: ["admin", "events", match.id],
    queryFn: async () => {
      const { data } = await supabase.from("match_events").select("*").eq("match_id", match.id).order("minute", { nullsFirst: true });
      return (data ?? []) as MatchEvent[];
    },
  });
  const playersQ = useQuery({
    enabled: teamIds.length > 0,
    queryKey: ["admin", "players-of-match", match.id, teamIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("*").in("team_id", teamIds);
      return (data ?? []) as Player[];
    },
  });
  const players = playersQ.data ?? [];
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name ?? "";
  const playerName = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? "";

  const [composer, setComposer] = useState<{ type: string } | null>(null);
  const [editing, setEditing] = useState<MatchEvent | null>(null);

  const patchMatch = async (patch: Partial<Match>) => {
    await supabase.from("matches").update(patch as never).eq("id", match.id);
    onSaved();
  };

  const start = () => patchMatch({ timer_running: true, timer_started_at: new Date().toISOString(), status: match.status === "scheduled" ? "live" : match.status });
  const pause = () => patchMatch({ timer_running: false, timer_elapsed_seconds: matchClockSeconds(match), timer_started_at: null });
  const setMinute = (m: number) => patchMatch({ timer_elapsed_seconds: m * 60, timer_started_at: match.timer_running ? new Date().toISOString() : null, live_minute: m });

  useEffect(() => {
    if (!match.timer_running || match.status !== "live" || match.live_minute === minute) return;
    const sync = window.setTimeout(() => patchMatch({ live_minute: minute }), 1000);
    return () => window.clearTimeout(sync);
  }, [match.timer_running, match.status, match.live_minute, minute]);

  const scores = useMemo(() => {
    let h = 0, a = 0;
    for (const e of eventsQ.data ?? []) {
      const scoring = e.type === "goal" || e.type === "penalty_goal";
      const own = e.type === "own_goal";
      if (!scoring && !own) continue;
      const forHome = own ? e.team_id !== match.home_team_id : e.team_id === match.home_team_id;
      if (forHome) h++; else a++;
    }
    return { h, a };
  }, [eventsQ.data, match.home_team_id]);

  const notStarted = ["scheduled", "postponed", "cancelled"].includes(match.status);

  // Score always mirrors the logged events — no manual sync.
  useEffect(() => {
    if (eventsQ.isLoading || match.status === "awarded" || match.result_only) return;
    if (notStarted && (eventsQ.data ?? []).length === 0) return;
    if ((match.home_score ?? 0) === scores.h && (match.away_score ?? 0) === scores.a) return;
    supabase.from("matches").update({ home_score: scores.h, away_score: scores.a }).eq("id", match.id).then(onSaved);
  }, [scores.h, scores.a, eventsQ.isLoading, match.id, match.home_score, match.away_score, match.result_only, notStarted]);

  const resultOnlyToggle = (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div>
        <h3 className="text-sm font-bold">Result only mode</h3>
        <p className="text-[0.7rem] text-muted-foreground">
          {match.result_only
            ? "On — only the final score is recorded, and visitors see no timeline."
            : "Off — full live controls: clock, goals, cards and timeline."}
        </p>
      </div>
      <button type="button" onClick={() => patchMatch({ result_only: !match.result_only })}
        className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-bold ${match.result_only ? "bg-primary text-primary-foreground" : "border border-border"}`}>
        {match.result_only ? "Turn off" : "Turn on"}
      </button>
    </section>
  );

  if (match.result_only) {
    return (
      <div>
        {resultOnlyToggle}
        <ResultOnly match={match} />
      </div>
    );
  }

  return (
    <>
    {resultOnlyToggle}
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        {/* Clock */}
        <div className="rounded-lg border border-border bg-background/50 p-4 text-center">
          <div className="text-4xl font-black tabular-nums">{formatClock(seconds)}</div>
          <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">{minute}′ · {STATUS_LABELS[match.status] ?? match.status}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {match.timer_running
              ? <button className={btnGhost} onClick={pause}><Pause className="h-3.5 w-3.5" /> Stop clock</button>
              : <button className={btnPrimary} onClick={start}><Play className="h-3.5 w-3.5" /> {seconds > 0 ? "Resume" : "Start match"}</button>}
            <button className={btnGhost} onClick={() => patchMatch({ timer_running: false, timer_elapsed_seconds: 0, timer_started_at: null })}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            <input type="number" placeholder="Set minute" className="h-9 w-28 rounded-full border border-border bg-background px-3 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") setMinute(Number((e.target as HTMLInputElement).value || 0)); }} />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs" value={match.status} onChange={(e) => { const status = e.target.value; patchMatch({ status, ...(["ft", "aet", "pen", "awarded", "cancelled", "postponed", "interrupted"].includes(status) ? { timer_running: false, timer_started_at: null } : {}) }); }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-sm font-bold tabular-nums">{notStarted && match.home_score == null && match.away_score == null ? "– : –" : `${match.home_score ?? 0} – ${match.away_score ?? 0}`}</span>
          </div>
        </div>

        {/* Quick event buttons */}
        <h3 className="mb-2 mt-5 text-sm font-bold">Add match event</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EVENT_TYPES.map((t) => (
            <button key={t.v} className={btnGhost} onClick={() => setComposer({ type: t.v })}><span className="text-base leading-none">{eventIcon(t.v)}</span> {t.l}</button>
          ))}
        </div>

        {composer && (
          <EventForm
            title={EVENT_TYPES.find((t) => t.v === composer.type)?.l ?? "Event"}
            initial={{ type: composer.type, minute }}
            teamIds={teamIds}
            teams={teams}
            players={players}
            onCancel={() => setComposer(null)}
            onSubmit={async (ev) => {
              await supabase.from("match_events").insert({ ...ev, match_id: match.id } as never);
              setComposer(null);
              qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
            }}
          />
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold">Match events</h4>
        <div className="grid gap-1">
          {(eventsQ.data ?? []).map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-xs">
              <span className="w-10 font-mono text-muted-foreground">{e.minute ?? "?"}{e.extra ? `+${e.extra}` : ""}′</span>
              <span className="flex w-28 shrink-0 items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest"><span className="text-sm leading-none">{eventIcon(e.type)}</span>{(EVENT_TYPES.find((t) => t.v === e.type)?.l ?? e.type)}</span>
              <span className="flex-1 truncate">{playerName(e.player_id)}{e.assist_player_id ? ` (assist ${playerName(e.assist_player_id)})` : ""} {e.description ? `— ${e.description}` : ""}</span>
              <span className="shrink-0 text-[0.6rem] text-muted-foreground">{teamName(e.team_id)}</span>
              <button onClick={() => setEditing(e)} className="text-primary">Edit</button>
              <button onClick={async () => { await supabase.from("match_events").delete().eq("id", e.id); qc.invalidateQueries({ queryKey: ["admin", "events", match.id] }); }} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {eventsQ.data && eventsQ.data.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-[0.65rem] text-muted-foreground">No events yet.</div>}
        </div>

        <MatchStatsEditor match={match} teams={teams} />

        {editing && (
          <div className="mt-3">
            <EventForm
              title="Edit event"
              initial={editing}
              teamIds={teamIds}
              teams={teams}
              players={players}
              onCancel={() => setEditing(null)}
              onSubmit={async (ev) => {
                await supabase.from("match_events").update(ev as never).eq("id", editing.id);
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["admin", "events", match.id] });
              }}
            />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function EventForm({
  title, initial, teamIds, teams, players, onSubmit, onCancel,
}: {
  title: string;
  initial: Partial<MatchEvent>;
  teamIds: string[];
  teams: Team[];
  players: Player[];
  onSubmit: (ev: Partial<MatchEvent>) => Promise<void>;
  onCancel: () => void;
}) {
  const [ev, setEv] = useState<Partial<MatchEvent>>(initial);
  const isGoal = ev.type === "goal" || ev.type === "penalty_goal" || ev.type === "own_goal";
  const isSub = ev.type === "substitution";
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const pool = players.filter((p) => !ev.team_id || p.team_id === ev.team_id);

  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-primary/40 bg-background/60 p-3">
      <div className="text-xs font-bold">{title}</div>
      {isGoal && (
        <div className="flex gap-2">
          {GOAL_KINDS.map((g) => (
            <button key={g.v} type="button" onClick={() => setEv({ ...ev, type: g.v })}
              className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold ${ev.type === g.v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{g.l}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Minute" className={inputCls} value={ev.minute ?? ""} onChange={(e) => setEv({ ...ev, minute: e.target.value ? Number(e.target.value) : null })} />
        <input type="number" placeholder="Added time (+)" className={inputCls} value={ev.extra ?? ""} onChange={(e) => setEv({ ...ev, extra: e.target.value ? Number(e.target.value) : null })} />
        <select className={inputCls} value={ev.team_id ?? ""} onChange={(e) => setEv({ ...ev, team_id: e.target.value || null, player_id: null })}>
          <option value="">Team</option>
          {teamIds.map((id) => <option key={id} value={id}>{teamName(id)}</option>)}
        </select>
        <select className={inputCls} value={ev.player_id ?? ""} onChange={(e) => setEv({ ...ev, player_id: e.target.value || null })}>
          <option value="">{isSub ? "Player coming on" : "Player"}</option>
          {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {ev.type === "goal" && (
          <select className={inputCls} value={ev.assist_player_id ?? ""} onChange={(e) => setEv({ ...ev, assist_player_id: e.target.value || null })}>
            <option value="">Assist (optional)</option>
            {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {isSub && (
          <select className={inputCls} value={ev.sub_out_player_id ?? ""} onChange={(e) => setEv({ ...ev, sub_out_player_id: e.target.value || null })}>
            <option value="">Player going off</option>
            {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <input className={inputCls} placeholder="Description (optional)" value={ev.description ?? ""} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnPrimary} onClick={() => onSubmit(ev)}><Plus className="h-3.5 w-3.5" /> Save event</button>
      </div>
    </div>
  );
}

export { btnDanger };