import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, slugify, type Competition } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { CountrySelect } from "@/components/country-select";

type Form = Partial<Competition>;
const empty: Form = { name: "", slug: "", sport: "football", format: "league", featured: false, sort_order: 0 };

export function CompetitionsPanel({ onOpen }: { onOpen: (c: Competition) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const q = useQuery({
    queryKey: ["admin", "competitions"],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").order("sort_order").order("name");
      return (data ?? []) as Competition[];
    },
  });
  const teams = useQuery({
    queryKey: ["admin", "team-library"],
    queryFn: async () => (await supabase.from("teams").select("id,name").order("name")).data ?? [],
  });

  const save = async () => {
    const payload = { ...form, slug: form.slug || slugify(form.name ?? ""), seasons: form.seasons ?? (form.season ? [form.season] : []) };
    if (!payload.name) return;
    if (form.id) await supabase.from("competitions").update(payload).eq("id", form.id);
    else await supabase.from("competitions").insert(payload as never);
    setOpen(false);
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this competition and everything inside?")) return;
    await supabase.from("competitions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "competitions"] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Competitions</h2>
        <button className={btnPrimary} onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> New competition
        </button>
      </div>

      <div className="grid gap-2">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
              {c.logo_url ? <img src={c.logo_url} className="h-full w-full object-contain" alt="" /> : <span className="text-xs">🏆</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{[c.country, c.season, c.format].filter(Boolean).join(" · ")}</div>
            </div>
            <button className={btnGhost} onClick={() => onOpen(c)}>Manage <ChevronRight className="h-3.5 w-3.5" /></button>
            <button className={btnGhost} onClick={() => { setForm(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No competitions yet. Create one to get started.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit competition" : "New competition"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Sport"><select className={inputCls} value={form.sport ?? "football"} onChange={(e) => setForm({ ...form, sport: e.target.value })}><option value="football">Football</option><option value="basketball">Basketball</option><option value="american_football">American football</option><option value="hockey">Hockey</option><option value="volleyball">Volleyball</option><option value="handball">Handball</option></select></Field>
          <Field label="Country"><CountrySelect value={form.country} onChange={(name, country) => setForm({ ...form, country: name, country_code: country?.code ?? null })} /></Field>
          <Field label="Category">
            <select className={inputCls} value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value || null })}>
              <option value="">Choose a category</option>
              {["Professional", "Amateur", "Youth", "Women", "Reserves", "International", "Club", "Cup", "Futsal", "Friendly", "Other"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Season"><input className={inputCls} placeholder="2025/2026" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })} /></Field>
          <Field label="Seasons"><div className="space-y-2"><div className="flex flex-wrap gap-2">{(form.seasons ?? []).map((season) => <button type="button" key={season} className="rounded-full border border-border px-3 py-1 text-xs" onClick={() => setForm({ ...form, seasons: (form.seasons ?? []).filter((item) => item !== season) })}>{season} ×</button>)}</div><input className={inputCls} placeholder="Add a season, for example 25/26, then press Enter" onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); const season = e.currentTarget.value.trim(); if (season && !(form.seasons ?? []).includes(season)) setForm({ ...form, seasons: [...(form.seasons ?? []), season] }); e.currentTarget.value = ""; }} /></div></Field>
          <Field label="Format">
            <select className={inputCls} value={form.format ?? "league"} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="league">League</option>
              <option value="knockout">Knockout</option>
              <option value="group+knockout">Groups + Knockout</option>
              <option value="cup">Cup</option>
              <option value="friendly">Friendly</option>
            </select>
          </Field>
          <Field label="Sort order"><input type="number" className={inputCls} value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
          <Field label="Starts on"><input type="date" className={inputCls} value={form.starts_on ?? ""} onChange={(e) => setForm({ ...form, starts_on: e.target.value || null })} /></Field>
          <Field label="Ends on"><input type="date" className={inputCls} value={form.ends_on ?? ""} onChange={(e) => setForm({ ...form, ends_on: e.target.value || null })} /></Field>
          <Field label="Higher division"><select className={inputCls} value={form.higher_division_id ?? ""} onChange={(e) => setForm({ ...form, higher_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Lower division"><select className={inputCls} value={form.lower_division_id ?? ""} onChange={(e) => setForm({ ...form, lower_division_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Parent competition"><select className={inputCls} value={form.parent_competition_id ?? ""} onChange={(e) => setForm({ ...form, parent_competition_id: e.target.value || null })}><option value="">None</option>{(q.data ?? []).filter((item) => item.id !== form.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Title holder"><select className={inputCls} value={form.title_holder_team_id ?? ""} onChange={(e) => setForm({ ...form, title_holder_team_id: e.target.value || null })}><option value="">None</option>{teams.data?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Standings mode"><select className={inputCls} value={form.standings_mode ?? "table"} onChange={(e) => setForm({ ...form, standings_mode: e.target.value })}><option value="table">League table</option><option value="groups">Groups</option><option value="knockout">Knockout</option></select></Field>
          <div className="sm:col-span-2">
            <Field label="Logo">
              <ImageInput value={form.logo_url ?? null} onChange={(v) => setForm({ ...form, logo_url: v })} onFile={async (f) => { const url = await uploadMedia("competition-logos", f); if (url) setForm({ ...form, logo_url: url }); }} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea rows={3} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured ?? false} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          <label className="flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.is_national ?? false} onChange={(e) => setForm({ ...form, is_national: e.target.checked })} />
            <span><strong className="block">National teams competition</strong>Squads are call-ups: a player keeps his club and can wear a different national photo and shirt number.</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  );
}