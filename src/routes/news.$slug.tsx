import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, BackButton, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, type NewsPost } from "@/lib/db";
import { useAutoTranslate, useDates, useNum } from "@/lib/auto-translate";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/news/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — MansourAlmailScores` },
      { name: "description", content: "Full article on MansourAlmailScores." },
      { property: "og:title", content: "MansourAlmailScores news" },
      { property: "og:description", content: "Full article on MansourAlmailScores." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["news", slug],
    queryFn: async () => {
      const { data } = await supabase.from("news_posts").select("*").eq("slug", slug).not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
      return data as NewsPost | null;
    },
  });
  const n = q.data ?? null;
  const { lang, t } = useI18n();
  const num = useNum();
  const dates = useDates();
  const tx = useAutoTranslate([n?.title, n?.excerpt, n?.body_markdown]);
  if (q.isLoading) return <AppShell><LoadingSkeleton /></AppShell>;
  if (!n) return <AppShell><EmptyState title={tx("Article not found")} /></AppShell>;
  return (
    <AppShell>
      <BackButton />
       <Link to="/news" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {t("nav.news")}</Link>
      <article className="overflow-hidden rounded-3xl border border-border bg-card">
        {n.cover_url && (
          <div className="flex w-full items-center justify-center bg-gradient-to-br from-primary/25 via-card to-background">
            <img src={n.cover_url} alt="" className="max-h-[70vh] w-full object-contain" />
          </div>
        )}
        <div className="p-6 sm:p-8">
           <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{lang === "ar" && n.title_ar ? n.title_ar : tx(n.title)}</h1>
          <div className="mt-2 text-xs text-muted-foreground">
            {n.published_at ? num(dates.date(n.published_at, { dateStyle: "long" })) : ""}
            {n.author_display ? ` · ${n.author_display}` : ""}
          </div>
          <div className="mt-6 space-y-4 text-[0.95rem] leading-7 text-foreground/90">
             {(lang === "ar" && n.body_markdown_ar ? n.body_markdown_ar : tx(n.body_markdown)).split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>)}
          </div>
        </div>
      </article>
    </AppShell>
  );
}