import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase, POSITIONS, type Player, type Team } from "@/lib/db";
import { Field, Modal, inputCls, btnPrimary, btnGhost } from "./ui";
import { CountrySelect } from "@/components/country-select";
import { DateWheel } from "@/components/date-wheel";
import { readAiImages, type AiImageInput } from "@/lib/image-files";
import { createPlayerDraftsWithAlmail } from "@/lib/almail-ai.functions";
import { Check, ImagePlus, Loader2, Sparkles, SkipForward, X } from "lucide-react";

type Draft = Partial<Player>;

/** Attach many photos, let Almail AI read every player in them, then approve one player at a time. */
export function PlayerBatchImport({ open, onClose, teamId = null, onSaved }: { open: boolean; onClose: () => void; teamId?: string | null; onSaved?: () => void }) {
  const run = useServerFn(createPlayerDraftsWithAlmail);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<AiImageInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Draft[]>([]);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<Draft | null>(null);
  const [approved, setApproved] = useState(0);

  const teams = useQuery({
    queryKey: ["admin", "team-names"],
    queryFn: async () => ((await supabase.from("teams").select("id,name").order("name")).data ?? []) as Pick<Team, "id" | "name">[],
  });

  const reset = () => { setQueue([]); setIndex(0); setCurrent(null); setApproved(0); setError(null); };

  const analyse = async () => {
    if (!notes.trim() && images.length === 0) return;
    setBusy(true); setError(null);
    try {
      const drafts = await run({ data: { notes, images } });
      if (drafts.length === 0) { setError("Almail AI could not find any players in what you shared."); setQueue([]); setCurrent(null); }
      else {
        const rows = drafts.map((d) => ({ ...d, team_id: teamId })) as Draft[];
        setQueue(rows); setIndex(0); setCurrent(rows[0] ?? null); setApproved(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Almail AI is unavailable right now.");
    } finally { setBusy(false); }
  };

  const advance = (nextIndex: number) => {
    if (nextIndex >= queue.length) { setCurrent(null); setIndex(nextIndex); return; }
    setIndex(nextIndex); setCurrent(queue[nextIndex] ?? null);
  };

  const approve = async () => {
    if (!current?.name?.trim()) return;
    setBusy(true); setError(null);
    const { error: insertError } = await supabase.from("players").insert({ ...current, name: current.name.trim() } as never);
    setBusy(false);
    if (insertError) { setError(insertError.message); return; }
    setApproved((n) => n + 1);
    onSaved?.();
    advance(index + 1);
  };

  const done = queue.length > 0 && !current;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Almail AI · read players from photos" wide>
      {queue.length === 0 ? (
        <div className="space-y-3">
          <Field label="Notes (optional)">
            <textarea className={`${inputCls} min-h-24`} maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste squad information, or describe the attached photos…" />
          </Field>
          <label className={`${btnGhost} cursor-pointer`}>
            <ImagePlus className="h-3.5 w-3.5" /> Attach photos (up to 20)
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple
              onChange={async (e) => { if (e.target.files?.length) setImages(await readAiImages(e.target.files, 20)); e.target.value = ""; }} />
          </label>
          {images.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {images.length} photo(s) attached
              <button className={btnGhost} onClick={() => setImages([])}><X className="h-3 w-3" /> Clear</button>
            </div>
          )}
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
          <button className={btnPrimary} disabled={busy || (!notes.trim() && images.length === 0)} onClick={analyse}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate all players
          </button>
        </div>
      ) : done ? (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-primary">Added {approved} player{approved === 1 ? "" : "s"} of {queue.length} found.</div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={reset}><Sparkles className="h-3.5 w-3.5" /> Read more photos</button>
            <button className={btnGhost} onClick={() => { reset(); onClose(); }}>Close</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Player {index + 1} of {queue.length}</span>
            <span>{approved} approved</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className={inputCls} value={current?.name ?? ""} onChange={(e) => setCurrent({ ...current, name: e.target.value })} /></Field>
            <Field label="Position">
              <select className={inputCls} value={current?.position ?? "Unknown"} onChange={(e) => setCurrent({ ...current, position: e.target.value })}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Club">
              <select className={inputCls} value={current?.team_id ?? ""} onChange={(e) => setCurrent({ ...current, team_id: e.target.value || null })}>
                <option value="">Free agent</option>
                {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Shirt #"><input type="number" className={inputCls} value={current?.shirt_number ?? ""} onChange={(e) => setCurrent({ ...current, shirt_number: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Height (cm)"><input type="number" className={inputCls} value={current?.height_cm ?? ""} onChange={(e) => setCurrent({ ...current, height_cm: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Market value"><input className={inputCls} value={current?.market_value ?? ""} onChange={(e) => setCurrent({ ...current, market_value: e.target.value })} /></Field>
            <Field label="Date of birth"><DateWheel value={current?.dob} onChange={(v) => setCurrent({ ...current, dob: v })} /></Field>
            <Field label="Nationality">
              <CountrySelect value={current?.nationality} onChange={(name, c) => setCurrent({ ...current, nationality: name, nationality_code: c?.code ?? null })} />
            </Field>
          </div>
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={busy || !current?.name?.trim()} onClick={approve}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve & next
            </button>
            <button className={btnGhost} disabled={busy} onClick={() => advance(index + 1)}><SkipForward className="h-3.5 w-3.5" /> Skip</button>
            <button className={btnGhost} disabled={busy} onClick={() => { reset(); }}><X className="h-3.5 w-3.5" /> Start over</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
