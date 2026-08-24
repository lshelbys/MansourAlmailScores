import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, slugify, type NewsPost } from "@/lib/db";
import { Field, Modal, ImageInput, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui";
import { uploadMedia } from "./upload";
import { createArticleDraftWithAlmail } from "@/lib/almail-ai.functions";
import { readAiImages, type AiImageInput } from "@/lib/image-files";
import { NewsLinkPicker, type NewsLinks } from "./news-link-picker";
import { NewsSubmissionsPanel } from "./news-submissions-panel";
import { Plus, Pencil, Trash2, Sparkles, ImagePlus, Loader2 } from "lucide-react";

type Form = Partial<NewsPost>;

export function NewsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiImages, setAiImages] = useState<AiImageInput[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const createAiDraft = useServerFn(createArticleDraftWithAlmail);

  const q = useQuery({
    queryKey: ["admin", "news"],
    queryFn: async () => {
      const { data } = await supabase.from("news_posts").select("*").order("created_at", { ascending: false });
      return (data ?? []) as NewsPost[];
    },
  });

  const save = async () => {
    if (!form.title) return;
    const payload = {
      ...form,
      slug: form.slug || slugify(form.title),
      body_markdown: form.body_markdown ?? "",
      title_ar: form.title_ar ?? null,
      excerpt_ar: form.excerpt_ar ?? null,
      body_markdown_ar: form.body_markdown_ar ?? null,
      team_id: form.team_id ?? null,
      competition_id: form.competition_id ?? null,
      player_id: form.player_id ?? null,
    };
    if (form.id) await supabase.from("news_posts").update(payload).eq("id", form.id);
    else await supabase.from("news_posts").insert(payload as never);
    setOpen(false); setForm({});
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("news_posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const togglePublish = async (p: NewsPost) => {
    await supabase.from("news_posts").update({ published_at: p.published_at ? null : new Date().toISOString() }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["admin", "news"] });
  };

  const generateArticle = async () => {
    if (!aiNotes.trim() && aiImages.length === 0) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const draft = await createAiDraft({ data: { notes: aiNotes, images: aiImages } });
      setForm({ ...draft, slug: slugify(draft.title) });
      setAiOpen(false);
      setOpen(true);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Almail AI could not draft this article.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">News</h2>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => { setAiError(null); setAiOpen(true); }}><Sparkles className="h-3.5 w-3.5" /> Write with Almail AI</button>
          <button className={btnPrimary} onClick={() => { setForm({}); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> New post</button>
        </div>
      </div>

      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="Almail AI news writer" wide>
        <p className="mb-3 text-sm text-muted-foreground">Attach a photo, paste your reporting notes, or use both. The result opens as an editable draft and is never published automatically.</p>
        <textarea className={inputCls} rows={7} maxLength={10000} placeholder="Add the facts, score, names, quotes, or context Almail AI should use…" value={aiNotes} onChange={(event) => setAiNotes(event.target.value)} />
        <label className={`${btnGhost} mt-3 cursor-pointer`}>
          <ImagePlus className="h-3.5 w-3.5" /> Add images
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (event) => {
            if (event.target.files) setAiImages(await readAiImages(event.target.files));
          }} />
        </label>
        {aiImages.length > 0 && <div className="mt-2 text-xs text-muted-foreground">{aiImages.length} image{aiImages.length === 1 ? "" : "s"} attached</div>}
        {aiError && <div className="mt-2 text-sm text-destructive">{aiError}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setAiOpen(false)}>Cancel</button>
          <button className={btnPrimary} disabled={aiBusy || (!aiNotes.trim() && aiImages.length === 0)} onClick={generateArticle}>
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate editable draft
          </button>
        </div>
      </Modal>
      <div className="grid gap-2">
        {(q.data ?? []).map((n) => (
          <div key={n.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            {n.cover_url && <img src={n.cover_url} alt="" className="h-12 w-16 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{n.title}</div>
              <div className="truncate text-xs text-muted-foreground">{n.published_at ? `Published · ${new Date(n.published_at).toLocaleString()}` : "Draft"}</div>
            </div>
            <button className={btnGhost} onClick={() => togglePublish(n)}>{n.published_at ? "Unpublish" : "Publish"}</button>
            <button className={btnGhost} onClick={() => { setForm(n); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button className={btnDanger} onClick={() => remove(n.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No posts yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit post" : "New post"} wide>
        <div className="grid gap-3">
          <Field label="Title"><input className={inputCls} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug"><input className={inputCls} value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            <Field label="Author"><input className={inputCls} value={form.author_display ?? ""} onChange={(e) => setForm({ ...form, author_display: e.target.value })} /></Field>
          </div>
          <Field label="Cover">
            <ImageInput value={form.cover_url ?? null} onChange={(v) => setForm({ ...form, cover_url: v })} onFile={async (f) => { const url = await uploadMedia("news-covers", f); if (url) setForm({ ...form, cover_url: url }); }} />
          </Field>
          <NewsLinkPicker
            teamId={form.team_id ?? null}
            competitionId={form.competition_id ?? null}
            playerId={form.player_id ?? null}
            onChange={(links: NewsLinks) => setForm({ ...form, ...links })}
          />
          <Field label="Excerpt"><textarea rows={2} className={inputCls} value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
          <Field label="Body (Markdown)"><textarea rows={8} className={inputCls} value={form.body_markdown ?? ""} onChange={(e) => setForm({ ...form, body_markdown: e.target.value })} /></Field>
           <div className="border-t border-border pt-3 text-sm font-bold">Arabic edition</div>
           <Field label="Arabic title"><input dir="rtl" className={inputCls} value={form.title_ar ?? ""} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></Field>
           <Field label="Arabic excerpt"><textarea dir="rtl" rows={2} className={inputCls} value={form.excerpt_ar ?? ""} onChange={(e) => setForm({ ...form, excerpt_ar: e.target.value })} /></Field>
           <Field label="Arabic body (Markdown)"><textarea dir="rtl" rows={8} className={inputCls} value={form.body_markdown_ar ?? ""} onChange={(e) => setForm({ ...form, body_markdown_ar: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.checked ? new Date().toISOString() : null })} /> Publish now</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Save</button>
        </div>
      </Modal>

      <div className="mt-10">
        <NewsSubmissionsPanel />
      </div>
    </div>
  );
}