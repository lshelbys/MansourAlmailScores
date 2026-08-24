import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, POSITIONS, type Player, type Team } from "@/lib/db";
import { Field, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { CountrySelect } from "@/components/country-select";
import { DateWheel } from "@/components/date-wheel";
import { TransfersEditor } from "./transfers-editor";
import { createPlayerDraftWithAlmail } from "@/lib/almail-ai.functions";
import { readAiImages, type AiImageInput } from "@/lib/image-files";
import { releasePlayerToFreeAgent, transferPlayerToClub, deletePlayerForever } from "@/lib/player-moves";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MediaUrls } from "./media-urls";
import { ArrowLeft, ImagePlus, Loader2, Plus, Save, Sparkles, Trash2, UserMinus, X } from "lucide-react";

/** Full-page player editor: details, Almail AI assist, transfer history and squad moves. */
export function PlayerEditor({ player, teamId, teamName, onClose }: { player: Partial<Player>; teamId?: string | null; teamName?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Player>>(player);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiImages, setAiImages] = useState<AiImageInput[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const createAiDraft = useServerFn(createPlayerDraftWithAlmail);

  const teams = useQuery({ queryKey: ["admin", "team-names"], queryFn: async () => ((await supabase.from("teams").select("id,name").order("name")).data ?? []) as Pick<Team, "id" | "name">[] });
  const currentTeam = useQuery({
    enabled: !!form.team_id,
    queryKey: ["admin", "player-team", form.team_id],
    queryFn: async () => ((await supabase.from("teams").select("id,name").eq("id", form.team_id!).maybeSingle()).data) as Pick<Team, "id" | "name"> | null,
  });
  const clubName = teamName ?? currentTeam.data?.name ?? null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "players"] });
    qc.invalidateQueries({ queryKey: ["admin", "all-players"] });
  };

  const save = async () => {
    if (!form.name?.trim()) return;
    setBusy(true);
    const payload = { ...form, team_id: form.team_id ?? teamId ?? null };
    if (form.id) await supabase.from("players").update(payload).eq("id", form.id);
    else {
      const { data } = await supabase.from("players").insert(payload as never).select("*").maybeSingle();
      if (data) setForm(data as Player);
    }
    setBusy(false); setSaved(true);
    invalidate();
  };

  const generateDraft = async () => {
    if (!aiNotes.trim() && aiImages.length === 0) return;
    setAiBusy(true); setAiError(null);
    try {
      const draft = await createAiDraft({ data: { notes: aiNotes, images: aiImages } });
      setForm({ ...form, ...Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== null && v !== "")) });
      setAiOpen(false);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Almail AI could not read this player.");
    } finally { setAiBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <button className={btnGhost} onClick={onClose}><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          <button className={btnPrimary} disabled={busy || !form.name?.trim()} onClick={save}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {form.id ? "Save" : "Create"}
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold">{form.name || "New player"}{clubName ? ` · ${clubName}` : " · Free agent"}</div>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" /> Almail AI player assistant</div>
            <button className={btnGhost} onClick={() => { setAiError(null); setAiOpen(!aiOpen); }}>{aiOpen ? <X className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} {aiOpen ? "Close" : "Edit with AI"}</button>
          </div>
          {aiOpen && (
            <div className="mt-3">
              <textarea className={inputCls} rows={4} maxLength={10000} placeholder="Paste player information or describe the attached photos…" value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className={`${btnGhost} cursor-pointer`}>
                  <ImagePlus className="h-3.5 w-3.5" /> Add photos
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (e) => { if (e.target.files?.length) setAiImages(await readAiImages(e.target.files)); e.target.value = ""; }} />
                </label>
                {aiImages.length > 0 && <span className="text-xs text-muted-foreground">{aiImages.length} attached</span>}
                <button className={btnPrimary} disabled={aiBusy || (!aiNotes.trim() && aiImages.length === 0)} onClick={generateDraft}>
                  {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Fill the fields
                </button>
              </div>
              {aiError && <div className="mt-2 text-xs text-destructive">{aiError}</div>}
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name *"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Position">
            <select className={inputCls} value={form.position ?? "Unknown"} onChange={(e) => setForm({ ...form, position: e.target.value })}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Club">
            <select className={inputCls} value={form.team_id ?? ""} onChange={(e) => setForm({ ...form, team_id: e.target.value || null })}>
              <option value="">Free agent</option>
              {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Shirt #"><input type="number" className={inputCls} value={form.shirt_number ?? ""} onChange={(e) => setForm({ ...form, shirt_number: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Height (cm)"><input type="number" className={inputCls} value={form.height_cm ?? ""} onChange={(e) => setForm({ ...form, height_cm: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Market value (€)"><input className={inputCls} placeholder="€12m" value={form.market_value ?? ""} onChange={(e) => setForm({ ...form, market_value: e.target.value })} /></Field>
          <Field label="Date of birth"><DateWheel value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} /></Field>
          <Field label="Nationality">
            <CountrySelect value={form.nationality} onChange={(name, c) => setForm({ ...form, nationality: name, nationality_code: c?.code ?? null })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Photo">
            <ImageInput value={form.photo_url ?? null} onChange={(v) => setForm({ ...form, photo_url: v })} onFile={async (f) => { const url = await uploadMedia("player-photos", f); if (url) setForm({ ...form, photo_url: url }); }} />
          </Field></div>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Media gallery">
            <MediaUrls urls={form.media_urls ?? []} onChange={(v) => setForm({ ...form, media_urls: v })} bucket="player-photos" />
          </Field></div>
        </div>

        {form.id ? (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="rounded-2xl border border-border bg-card p-4">
              <TransfersEditor personType="player" personId={form.id} personName={form.name ?? ""} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-bold">Squad moves</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select className={inputCls} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Transfer to another club…</option>
                  {(teams.data ?? []).filter((t) => t.id !== form.team_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className={btnPrimary} disabled={!moveTo} onClick={async () => {
                  const target = (teams.data ?? []).find((t) => t.id === moveTo);
                  if (!target) return;
                  await transferPlayerToClub({ id: form.id! }, clubName, target.id, target.name);
                  setForm({ ...form, team_id: target.id }); setMoveTo(""); invalidate();
                }}><Plus className="h-3.5 w-3.5" /> Complete transfer</button>
                {form.team_id && <button className={btnGhost} onClick={async () => {
                  await releasePlayerToFreeAgent({ id: form.id! }, clubName);
                  setForm({ ...form, team_id: null }); invalidate();
                }}><UserMinus className="h-3.5 w-3.5" /> Release to free agents</button>}
                <button className={btnDanger} onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete from database</button>
                <ConfirmDelete
                  open={confirmDelete}
                  title={`Delete ${form.name || "this player"}`}
                  description="This permanently removes the player from the database, including squad entries and history. This cannot be undone."
                  confirmWord="DELETE"
                  actionLabel="Delete player"
                  onCancel={() => setConfirmDelete(false)}
                  onConfirm={async () => { await deletePlayerForever(form.id!); setConfirmDelete(false); invalidate(); onClose(); }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Create the player to add transfer history and squad moves.</p>
        )}
        {saved && <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">Saved.</div>}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button className={btnPrimary} disabled={busy || !form.name?.trim()} onClick={save}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {form.id ? "Save" : "Create"}
          </button>
          <button className={btnGhost} onClick={onClose}><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        </div>
      </div>
    </div>
  );
}
