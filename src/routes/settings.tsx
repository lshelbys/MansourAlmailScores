import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { uploadMedia } from "@/components/admin/upload";
import { CURRENCIES, useCurrency } from "@/lib/currency";
import { deleteMyAccount } from "@/lib/account.functions";
import { useServerFn } from "@tanstack/react-start";
import { Save, LogOut, Loader2, LogIn, Camera, Trash2 } from "lucide-react";
import { ImageCropper } from "@/components/image-cropper";
import { ConfirmDelete } from "@/components/confirm-delete";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MansourAlmailScores" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const removeAccount = useServerFn(deleteMyAccount);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("display_name,language,avatar_url,height_unit").eq("id", user.id).maybeSingle();
      setDisplayName(prof?.display_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? null);
      if (prof?.height_unit === "ft" || prof?.height_unit === "cm") setHeightUnit(prof.height_unit);
      if (prof?.language && (prof.language === "en" || prof.language === "ar")) setLang(prof.language as Lang);
    })();
  }, [user, authLoading, setLang]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName, language: lang, theme, avatar_url: avatarUrl, height_unit: heightUnit }).eq("id", user.id);
    setSaving(false);
    setNotice(t("settings.saved"));
    setTimeout(() => setNotice(null), 1500);
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    const url = await uploadMedia("avatars", file);
    setUploading(false);
    if (!url) return;
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      {user && <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>}

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 text-sm font-semibold">{t("settings.profile")}</div>
        {user ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xl font-bold">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (displayName || user.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setAvatarFile(file); e.target.value = ""; }} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t("settings.displayName")}</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("settings.signInHint")}</p>
            <Link to="/auth" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              <LogIn className="h-4 w-4" /> {t("nav.signIn")}
            </Link>
          </div>
        )}
      </section>
      {avatarFile && <ImageCropper file={avatarFile} aspect={1} onCancel={() => setAvatarFile(null)} onDone={async (file) => { await pickAvatar(file); setAvatarFile(null); }} />}

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.language")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "ar"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`rounded-xl border px-3 py-2 text-sm ${lang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-3 text-sm font-semibold">{t("settings.theme")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((th) => (
              <button key={th} type="button" onClick={() => setTheme(th)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${theme === th ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
                {t(`settings.theme.${th}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 text-sm font-semibold">{t("settings.heightUnit")}</div>
        <div className="grid max-w-xs grid-cols-2 gap-2">
          {(["cm", "ft"] as const).map((u) => (
            <button key={u} type="button" onClick={() => setHeightUnit(u)}
              className={`rounded-xl border px-3 py-2 text-sm ${heightUnit === u ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
              {u === "cm" ? "cm" : "ft / in"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-6">
        <div className="mb-1 text-sm font-semibold">{t("settings.currency")}</div>
        <p className="mb-3 text-xs text-muted-foreground">{t("settings.currencyHint")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {CURRENCIES.map((c) => (
            <button key={c} type="button" onClick={() => setCurrency(c)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${currency === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {notice && <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</div>}

      {user && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("settings.save")}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent">
            <LogOut className="h-4 w-4" /> {t("settings.signOut")}
          </button>
        </div>
      )}

      {user && <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-destructive">{t("settings.deleteAccount")}</div>
            <p className="text-[0.65rem] text-muted-foreground">{t("settings.deleteAccountHint")}</p>
          </div>
          <button disabled={deleting} onClick={() => setConfirmDelete(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-3 text-[0.7rem] font-semibold text-destructive disabled:opacity-60">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} {t("settings.deleteAccount")}
          </button>
        </div>
        <ConfirmDelete
          open={confirmDelete}
          title={t("settings.deleteAccount")}
          description={t("settings.deleteAccountConfirm")}
          confirmWord="DELETE"
          actionLabel={t("settings.deleteAccount")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await removeAccount({});
              await supabase.auth.signOut();
              navigate({ to: "/" });
            } finally { setDeleting(false); setConfirmDelete(false); }
          }}
        />
      </section>}
    </AppShell>
  );
}