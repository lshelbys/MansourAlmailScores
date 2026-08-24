import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, type NewsPost } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { useAutoTranslate, useDates, useNum } from "@/lib/auto-translate";
import { useI18n } from "@/lib/i18n";
import { PenLine, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/news/")({
  head: () => ({ meta: [{ title: "News — MansourAlmailScores" }, { name: "description", content: "Latest football news from MansourAlmailScores." }] }),
  component: NewsPage,
});

function NewsPage() {
  useRealtime(["news_posts"]);
  const q = useQuery({ queryKey: ["news"], queryFn: async () => {
    const { data } = await supabase.from("news_posts").select("*").not("published_at", "is", null).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false });
    return (data ?? []) as NewsPost[];
  }});
  const posts = q.data ?? [];
  const { lang, t } = useI18n();
  const num = useNum();
  const dates = useDates();
  const tx = useAutoTranslate(posts.flatMap((n) => [n.title, n.excerpt]));
  return (
    <AppShell>
       <SectionHeader title={t("nav.news")} />

      <Link to="/contribute" className="mb-5 flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/20 via-card to-card p-4 transition hover:border-primary">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><PenLine className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{tx("Publish news")}</span>
          <span className="block text-xs text-muted-foreground">{tx("Join the reporter programme — $2.99 / month, every article reviewed by the main admin.")}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" />
      </Link>

      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.length === 0 ? (
        <EmptyState title={tx("No news yet")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((n) => (
            <Link key={n.id} to="/news/$slug" params={{ slug: n.slug }} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg">
              {n.cover_url && (
                <div className="relative flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/25 via-card to-background">
                  <img src={n.cover_url} alt="" className="relative h-full w-full object-contain" />
                </div>
              )}
              <div className="flex-1 p-4">
                 <h2 className="font-semibold">{lang === "ar" && n.title_ar ? n.title_ar : tx(n.title)}</h2>
                 {(n.excerpt || n.excerpt_ar) && <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" && n.excerpt_ar ? n.excerpt_ar : tx(n.excerpt)}</p>}
                <div className="mt-2 text-xs text-muted-foreground">{n.published_at ? num(dates.date(n.published_at)) : ""}{n.author_display ? ` · ${n.author_display}` : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}