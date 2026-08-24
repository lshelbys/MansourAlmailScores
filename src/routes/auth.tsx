import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MansourAlmailScores" },
      { name: "description", content: "Sign in or create your MansourAlmailScores account to follow live football scores, favorites, and personalized coverage." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your account.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!remember) {
          // Session persists in localStorage by default; opting out clears on tab close.
          try {
            const raw = localStorage.getItem("sb-" + import.meta.env.VITE_SUPABASE_PROJECT_ID + "-auth-token");
            if (raw) sessionStorage.setItem("sb-" + import.meta.env.VITE_SUPABASE_PROJECT_ID + "-auth-token", raw);
          } catch {
            /* ignore */
          }
        }
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setNotice("Password reset link sent. Check your inbox.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_30%,transparent),transparent_50%)]" />
      <div className="relative z-10 mx-auto flex max-w-md flex-col px-6 py-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            aria-label="Back to home"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link to="/" className="inline-flex">
            <BrandLogo variant="horizontal" className="h-9 w-auto" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Follow every match with your personalized feed."
              : mode === "forgot"
                ? "We'll email you a secure reset link."
                : "Sign in to continue to MansourAlmailScores."}
          </p>

          {mode !== "forgot" && (
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium transition hover:bg-accent disabled:opacity-60"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("apple")}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium transition hover:bg-accent disabled:opacity-60"
              >
                <AppleIcon /> Continue with Apple
              </button>
              <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <Field icon={<UserIcon className="h-4 w-4" />}>
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="email"
              />
            </Field>
            {mode !== "forgot" && (
              <Field icon={<Lock className="h-4 w-4" />}>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                />
              </Field>
            )}

            {mode === "signin" && (
              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            ) : mode === "forgot" ? (
              <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            ) : (
              <>
                New to MansourAlmailScores?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2.5 focus-within:border-primary">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.3h5.9c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.2-4.9 3.2-8.3z" />
      <path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.6-2-6.5-4.7H1.7v2.9C3.6 20.5 7.5 23 12 23z" />
      <path fill="#FBBC05" d="M5.5 13.8a6.7 6.7 0 0 1 0-4.6V6.3H1.7a11 11 0 0 0 0 10l3.8-2.5z" />
      <path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 2 15.1 1 12 1 7.5 1 3.6 3.5 1.7 7.3l3.8 2.9C6.4 7.4 9 5.4 12 5.4z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.8 1.3 10.4.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.5-.9 1.6 0 2.1.9 3.5.8 1.5 0 2.4-1.3 3.3-2.5.7-.9 1.2-1.9 1.6-3-.1 0-2.9-1.1-2.9-4.2zM13.6 4.4c.7-.9 1.2-2.1 1.1-3.4-1 .1-2.3.7-3 1.6-.6.8-1.2 2-1.1 3.2 1.2.1 2.3-.6 3-1.4z" />
    </svg>
  );
}