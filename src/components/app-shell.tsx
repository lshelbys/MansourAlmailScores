import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Home, Search, Trophy, Newspaper, ArrowLeftRight, Settings, LogIn, ArrowLeft } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { BrandLogo } from "@/components/brand-logo";

type NavItem = { to: "/" | "/search" | "/competitions" | "/news" | "/transfers" | "/settings"; labelKey: string; icon: typeof Home; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/search", labelKey: "nav.search", icon: Search },
  { to: "/competitions", labelKey: "nav.competitions", icon: Trophy },
  { to: "/news", labelKey: "nav.news", icon: Newspaper },
  { to: "/transfers", labelKey: "nav.transfers", icon: ArrowLeftRight },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  useEffect(() => { void user; }, [user]);

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["shell-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const initials = (profile.data?.display_name ?? user?.email ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background:radial-gradient(circle_at_10%_-10%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_100%_100%,color-mix(in_oklab,var(--primary)_15%,transparent),transparent_60%)]" />

      {!bare && <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex shrink-0 items-center gap-2">
            <BrandLogo className="h-10" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && (
              user ? (
                <Link
                  to="/settings"
                  aria-label={t("nav.settings")}
                  className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-sm font-bold text-foreground shadow-sm transition hover:ring-2 hover:ring-primary/50"
                >
                  {profile.data?.avatar_url
                    ? <img src={profile.data.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <span>{initials}</span>}
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow"
                >
                  <LogIn className="h-4 w-4" /> {t("nav.signIn")}
                </Link>
              )
            )}
          </div>
        </div>
      </header>}

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6">{children}</main>

      {!bare && <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-2 py-2">
          {NAV.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[0.6rem] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
      {action}
    </div>
  );
}

/** Back control for detail pages — steps through history, falling back to the home page. */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { lang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => { if (router.history.canGoBack()) router.history.back(); else router.navigate({ to: "/" }); }}
      className={`mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground ${className}`}
    >
      <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "رجوع" : "Back"}
    </button>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}

export function LoadingSkeleton({ count = 4, className = "h-24" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${className} animate-pulse rounded-2xl border border-border bg-card/50`} />
      ))}
    </div>
  );
}