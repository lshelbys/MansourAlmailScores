import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { uploadMedia } from "@/components/admin/upload";
import { createArticleDraftWithAlmail } from "@/lib/almail-ai.functions";
import { readAiImages, type AiImageInput } from "@/lib/image-files";
import { NewsLinkPicker, type NewsLinks } from "@/components/admin/news-link-picker";
import { redeemReporterCode } from "@/lib/reporter.functions";
import { Loader2, LogIn, Sparkles, ImagePlus, Send, BadgeCheck, Mail, KeyRound, Share2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title: "Reporter desk — MansourAlmailScores" },
      { name: "description", content: "Join the MansourAlmailScores reporter programme and submit football news for editorial review." },
      { property: "og:title", content: "Reporter desk — MansourAlmailScores" },
      { property: "og:description", content: "Submit football news for review as a subscribed MansourAlmailScores reporter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContributePage,
});

const PLATFORMS = ["tiktok", "instagram", "x", "youtube", "facebook", "other"] as const;
const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-primary sm:text-sm";

function ContributePage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [platform, setPlatform] = useState<string>("tiktok");
  const [handle, setHandle] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const redeem = useServerFn(redeemReporterCode);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [links, setLinks] = useState<NewsLinks>({ team_id: null, competition_id: null, player_id: null });
  const [proofNote, setProofNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [aiImages, setAiImages] = useState<AiImageInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const draft = useServerFn(createArticleDraftWithAlmail);

  const reporter = useQuery({
    enabled: !!user,
    queryKey: ["reporter", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("news_reporters").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("news_submissions").select("id,title,status,review_note,created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const apply = async () => {
    if (!user || !handle.trim() || !fullName.trim() || (!phone.trim() && !contactEmail.trim())) return;
    setApplying(true); setApplyError(null);
    const { error: insertError } = await supabase.from("news_reporters").insert({
      user_id: user.id,
      platform,
      handle: handle.replace(/^@/, ""),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: contactEmail.trim() || null,
    } as never);
    setApplying(false);
    if (insertError) { setApplyError(insertError.message); return; }
    await qc.invalidateQueries({ queryKey: ["reporter", user.id] });
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setCodeBusy(true); setCodeMsg(null);
    try {
      const res = await redeem({ data: { code: code.trim() } });
      if (res.ok) { setCodeMsg(null); qc.invalidateQueries({ queryKey: ["reporter", user?.id] }); }
      else setCodeMsg(res.reason === "no-application" ? "Register your details first." : "That access code is not valid yet.");
    } catch { setCodeMsg("Could not check that code. Please try again."); }
    finally { setCodeBusy(false); }
  };

  const generate = async () => {
    if (!aiNotes.trim() && aiImages.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await draft({ data: { notes: aiNotes, images: aiImages } });
      setTitle(result.title); setExcerpt(result.excerpt); setBody(result.body_markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Almail AI could not draft this article.");
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("news_submissions").insert({
      author_id: user.id,
      title: title.trim(),
      excerpt: excerpt || null,
      body_markdown: body,
      cover_url: cover,
      proof_note: proofNote || null,
      proof_url: proofUrl,
      ...links,
    } as never);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSent(true);
    setTitle(""); setExcerpt(""); setBody(""); setCover(null); setProofNote(""); setProofUrl(null);
    qc.invalidateQueries({ queryKey: ["my-submissions", user.id] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <h1 className="text-3xl font-black tracking-tight">{t("settings.reporter")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("settings.reporterHint")}</p>

      {!user ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t("settings.signInHint")}</p>
          <Link to="/auth" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            <LogIn className="h-4 w-4" /> {t("nav.signIn")}
          </Link>
        </div>
      ) : reporter.isPending ? (
        <div className="mt-6 flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your reporter status…
        </div>
      ) : !reporter.data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-6">
            <div className="flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4 text-primary" /> How to get access</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Contact <a href="mailto:mansouralmailscores@gmail.com" className="font-semibold text-primary">mansouralmailscores@gmail.com</a> to be given access to the news desk. The
              <strong className="text-foreground"> $2.99 / month subscription is included</strong> with your reporter access.
            </p>
            <ul className="mt-4 grid gap-2 text-sm">
              {[
                "Publish football news that the main admin reviews before it goes live",
                "Show your own social media username on every article you publish",
                "Draft in English and Arabic instantly with Almail AI",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="text-muted-foreground">{line}</span></li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">Register your details</div>
            <p className="mt-1 text-xs text-muted-foreground">The main admin checks your information and replies with an access code.</p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full name</label>
                <input className={`${inputCls} mt-1`} maxLength={120} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phone</label>
                  <input className={`${inputCls} mt-1`} maxLength={40} placeholder="+965…" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input className={`${inputCls} mt-1`} maxLength={160} placeholder="you@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Platform</label>
                  <select className={`${inputCls} mt-1`} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Username</label>
                  <input className={`${inputCls} mt-1`} placeholder="@username" value={handle} onChange={(e) => setHandle(e.target.value)} />
                </div>
              </div>
              <button disabled={applying || !handle.trim() || !fullName.trim() || (!phone.trim() && !contactEmail.trim())} onClick={apply} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Send my details
              </button>
              <p className="text-[0.7rem] text-muted-foreground">A phone number or an email is required so the admin can respond to you. If you have not heard back within 2 days, email <a href="mailto:mansouralmailscores@gmail.com" className="font-semibold text-primary">mansouralmailscores@gmail.com</a>.</p>
              {applyError && <p className="text-xs text-destructive">{applyError}</p>}
            </div>
          </section>
        </div>
      ) : !["active", "approved"].includes(reporter.data.status ?? "") ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-border bg-card p-6 text-sm">
          <div className="font-semibold">Your details are with the main admin</div>
          <p className="mt-1 text-muted-foreground">{reporter.data.full_name ? `${reporter.data.full_name} · ` : ""}@{reporter.data.handle} on {reporter.data.platform}.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Email <a href="mailto:mansouralmailscores@gmail.com" className="font-semibold text-primary">mansouralmailscores@gmail.com</a> if you have not heard back. Once the admin sends your
            access code, enter it below to open the news desk. Subscription $2.99 / month is included.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5 text-primary" /> Access code</span>
            <input className={`${inputCls} max-w-[12rem]`} placeholder="MAS-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
            <button disabled={codeBusy || !code.trim()} onClick={submitCode} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {codeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Unlock news desk
            </button>
          </div>
          {codeMsg && <div className="mt-2 text-xs text-destructive">{codeMsg}</div>}
        </section>
      ) : (
        <section className="mt-6 grid gap-4">
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Draft with Almail AI</div>
            <textarea className={`${inputCls} mt-3`} rows={5} maxLength={10000} placeholder="Paste your notes, score, names or quotes…" value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} />
            <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent">
              <ImagePlus className="h-3.5 w-3.5" /> Add images
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (e) => { if (e.target.files) setAiImages(await readAiImages(e.target.files)); }} />
            </label>
            {aiImages.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{aiImages.length} attached</span>}
            <div className="mt-3">
              <button disabled={busy} onClick={generate} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate draft
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">Your article</div>
            <div className="mt-3 grid gap-3">
              <input className={inputCls} placeholder="Headline" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className={inputCls} rows={2} placeholder="Short summary (optional)" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
              <textarea className={inputCls} rows={10} placeholder="Article body (Markdown)" value={body} onChange={(e) => setBody(e.target.value)} />
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cover photo</label>
                <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadMedia("news-covers", f); if (url) setCover(url);
                }} />
                {cover && <img src={cover} alt="" className="mt-2 max-h-56 w-full rounded-2xl bg-muted/60 object-contain" />}
              </div>
              <NewsLinkPicker teamId={links.team_id} competitionId={links.competition_id} playerId={links.player_id} onChange={setLinks} />
              <div className="rounded-2xl border border-dashed border-border p-3">
                <div className="text-sm font-semibold">Proof</div>
                <p className="mt-1 text-xs text-muted-foreground">Attach a photo or note that backs up your reporting. Required for approval.</p>
                <textarea className={`${inputCls} mt-2`} rows={2} placeholder="Source, link or explanation" value={proofNote} onChange={(e) => setProofNote(e.target.value)} />
                <input type="file" accept="image/*" className="mt-2 block text-xs" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadMedia("news-covers", f); if (url) setProofUrl(url);
                }} />
                {proofUrl && <div className="mt-1 text-xs text-muted-foreground">Attachment uploaded.</div>}
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              {sent && <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">Submitted for review. The main admin will approve or reject it.</div>}
              <button disabled={busy || !title.trim() || !body.trim()} onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for review
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">Your submissions</div>
            <div className="mt-3 grid gap-2">
              {(mine.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.title}</div>
                    {s.review_note && <div className="truncate text-xs text-muted-foreground">{s.review_note}</div>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">{s.status}</span>
                </div>
              ))}
              {mine.data && mine.data.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing submitted yet.</div>}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
