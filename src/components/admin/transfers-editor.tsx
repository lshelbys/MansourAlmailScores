import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, currentSeason, type Transfer, type Team } from "@/lib/db";
import { inputCls, btnPrimary, btnGhost } from "./ui";
import { createTransferDraftsWithAlmail } from "@/lib/almail-ai.functions";
import { readAiImages, type AiImageInput } from "@/lib/image-files";
import { Plus, Trash2, Sparkles, ImagePlus, Loader2, Pencil, Check, X } from "lucide-react";

const TYPES = ["Transfer", "Loan", "Loan return", "Free agent", "Youth promotion", "Retired", "Appointed", "Left"];

/** Pick a saved club or type any club name that is not in the database. */
export function ClubInput({ value, onChange, placeholder }: { value: string | null | undefined; onChange: (v: string | null) => void; placeholder: string }) {
  const teams = useQuery({ queryKey: ["admin", "team-names"], queryFn: async () => ((await supabase.from("teams").select("id,name").order("name")).data ?? []) as Pick<Team, "id" | "name">[] });
  const known = (teams.data ?? []).some((t) => t.name === value);
  const [manual, setManual] = useState(false);
  const typing = manual || (!!value && !known);
  return (
    <div className="grid gap-1">
      {typing ? (
        <input className={inputCls} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
      ) : (
        <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{placeholder}</option>
          {(teams.data ?? []).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      )}
      <button type="button" className="text-start text-[0.65rem] font-semibold text-primary" onClick={() => { setManual(!typing); onChange(null); }}>
        {typing ? "Pick a saved club" : "Type a club that is not saved"}
      </button>
    </div>
  );
}

export function TransfersEditor({ personType, personId, personName }: { personType: "player" | "coach"; personId: string; personName?: string }) {
  const qc = useQueryClient();
  const key = ["admin", "transfers", personType, personId];
  const [draft, setDraft] = useState<Partial<Transfer>>({ transfer_type: "Transfer", season: currentSeason() });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiImages, setAiImages] = useState<AiImageInput[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const readTransfers = useServerFn(createTransferDraftsWithAlmail);

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("transfers").select("*").eq("person_type", personType).eq("person_id", personId).order("moved_on", { ascending: false, nullsFirst: false });
      return (data ?? []) as Transfer[];
    },
  });

  const add = async () => {
    if (!draft.from_club && !draft.to_club) return;
    await supabase.from("transfers").insert({ ...draft, person_type: personType, person_id: personId } as never);
    setDraft({ transfer_type: "Transfer", season: currentSeason() });
    qc.invalidateQueries({ queryKey: key });
  };
  const remove = async (id: string) => {
    await supabase.from("transfers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };
  const [editId, setEditId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<Transfer>>({});
  const saveEdit = async () => {
    if (!editId) return;
    const { id: _id, person_id: _p, person_type: _t, created_at: _c, ...fields } = editRow as Transfer & { created_at?: string };
    await supabase.from("transfers").update(fields).eq("id", editId);
    setEditId(null); setEditRow({});
    qc.invalidateQueries({ queryKey: key });
  };

  const importWithAi = async () => {
    if (!aiNotes.trim() && aiImages.length === 0) return;
    setAiBusy(true); setAiError(null);
    try {
      const rows = await readTransfers({ data: { notes: aiNotes, images: aiImages, personName: personName ?? "" } });
      if (rows.length === 0) { setAiError("Almail AI could not find any transfers."); return; }
      await supabase.from("transfers").insert(rows.map((r) => ({ ...r, person_type: personType, person_id: personId })) as never);
      setAiOpen(false); setAiNotes(""); setAiImages([]);
      qc.invalidateQueries({ queryKey: key });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Almail AI could not read this history.");
    } finally { setAiBusy(false); }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Transfer history</div>
        <button type="button" className={btnGhost} onClick={() => { setAiError(null); setAiOpen(!aiOpen); }}><Sparkles className="h-3.5 w-3.5" /> Read with Almail AI</button>
      </div>

      {aiOpen && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 text-xs text-muted-foreground">Attach screenshots of a career table, or paste the history as text. Every row stays editable after import.</p>
          <textarea className={inputCls} rows={3} maxLength={10000} placeholder="Paste the career history…" value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className={`${btnGhost} cursor-pointer`}>
              <ImagePlus className="h-3.5 w-3.5" /> Add photos
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (e) => { if (e.target.files?.length) setAiImages(await readAiImages(e.target.files)); e.target.value = ""; }} />
            </label>
            {aiImages.length > 0 && <span className="text-xs text-muted-foreground">{aiImages.length} attached</span>}
            <button type="button" className={btnPrimary} disabled={aiBusy || (!aiNotes.trim() && aiImages.length === 0)} onClick={importWithAi}>
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Import history
            </button>
          </div>
          {aiError && <div className="mt-2 text-xs text-destructive">{aiError}</div>}
        </div>
      )}

      <div className="grid gap-1">
        {(q.data ?? []).map((tr) => editId === tr.id ? (
          <div key={tr.id} className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 sm:grid-cols-2">
            <ClubInput value={editRow.from_club} onChange={(v) => setEditRow({ ...editRow, from_club: v })} placeholder="From club" />
            <ClubInput value={editRow.to_club} onChange={(v) => setEditRow({ ...editRow, to_club: v })} placeholder="To club" />
            <input type="date" className={inputCls} value={editRow.moved_on ?? ""} onChange={(e) => setEditRow({ ...editRow, moved_on: e.target.value || null })} />
            <input className={inputCls} placeholder="Fee (optional)" value={editRow.fee ?? ""} onChange={(e) => setEditRow({ ...editRow, fee: e.target.value })} />
            <input className={inputCls} placeholder="Season e.g. 26/27" value={editRow.season ?? ""} onChange={(e) => setEditRow({ ...editRow, season: e.target.value })} />
            <select className={inputCls} value={editRow.transfer_type ?? "Transfer"} onChange={(e) => setEditRow({ ...editRow, transfer_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button className={btnPrimary} onClick={saveEdit}><Check className="h-3.5 w-3.5" /> Save changes</button>
              <button className={btnGhost} onClick={() => { setEditId(null); setEditRow({}); }}><X className="h-3.5 w-3.5" /> Cancel</button>
            </div>
          </div>
        ) : (
          <div key={tr.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{tr.moved_on ?? tr.season ?? "—"}</span>
            <span className="flex-1 truncate">{tr.from_club ?? "Free agent"} → {tr.to_club ?? "Free agent"}</span>
            <span className="shrink-0 text-muted-foreground">{[tr.transfer_type, tr.fee].filter(Boolean).join(" · ")}</span>
            <button onClick={() => { setEditId(tr.id); setEditRow(tr); }} className="text-muted-foreground hover:text-primary"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => remove(tr.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-2 text-center text-[0.65rem] text-muted-foreground">No transfers recorded.</div>}
      </div>

      <div className="mt-2 grid gap-2 rounded-lg border border-border bg-background/40 p-2 sm:grid-cols-2">
        <ClubInput value={draft.from_club} onChange={(v) => setDraft({ ...draft, from_club: v })} placeholder="From club" />
        <ClubInput value={draft.to_club} onChange={(v) => setDraft({ ...draft, to_club: v })} placeholder="To club" />
        <input type="date" className={inputCls} value={draft.moved_on ?? ""} onChange={(e) => setDraft({ ...draft, moved_on: e.target.value || null })} />
        <input className={inputCls} placeholder="Fee (optional)" value={draft.fee ?? ""} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} />
        <input className={inputCls} placeholder="Season e.g. 26/27" value={draft.season ?? ""} onChange={(e) => setDraft({ ...draft, season: e.target.value })} />
        <select className={inputCls} value={draft.transfer_type ?? "Transfer"} onChange={(e) => setDraft({ ...draft, transfer_type: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className={btnPrimary} onClick={add}><Plus className="h-3.5 w-3.5" /> Add transfer</button>
      </div>
    </div>
  );
}
