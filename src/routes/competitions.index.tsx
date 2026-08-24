import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton, SectionHeader } from "@/components/app-shell";
import { supabase, type Competition } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { Trophy } from "lucide-react";
import { useNum, useTx } from "@/lib/auto-translate";

export const Route = createFileRoute("/competitions/")({
  head: () => ({ meta: [{ title: "Competitions — MansourAlmailScores" }] }),
  component: CompetitionsList,
});

function CompetitionsList() {
  const tx = useTx();
  const num = useNum();
  useRealtime(["competitions"]);
  const q = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data } = await supabase.from("competitions").select("*").order("featured", { ascending: false }).order("sort_order");
      return (data ?? []) as Competition[];
    },
  });
  return (
    <AppShell>
      <SectionHeader title={tx("Competitions")} />
      {q.isLoading ? <LoadingSkeleton /> : !q.data || q.data.length === 0 ? (
        <EmptyState title={tx("No competitions yet")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((c) => (
            <Link key={c.id} to="/competitions/$slug" params={{ slug: c.slug }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-lg">
               <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl text-primary">
                {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{tx(c.name)}</div>
                <div className="truncate text-xs text-muted-foreground">{[tx(c.country), num(c.season)].filter(Boolean).join(" · ")}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}