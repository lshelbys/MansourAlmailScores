import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, LoadingSkeleton } from "@/components/app-shell";
import { supabase, currentSeason, seasonRange, type Transfer } from "@/lib/db";
import { useRealtime } from "@/lib/realtime";
import { ArrowRight, Repeat } from "lucide-react";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — MansourAlmailScores" },
      { name: "description", content: "Every player and coach move tracked across the competitions you follow." },
      { property: "og:title", content: "Transfers — MansourAlmailScores" },
      { property: "og:description", content: "Every player and coach move tracked across the competitions you follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersPage,
});

type Row = Transfer & { player?: { id: string; name: string; photo_url: string | null } | null };

const KIND_TONE: Record<string, string> = {
  Loan: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "Loan return": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "Free agent": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Retired: "bg-muted text-muted-foreground",
  Left: "bg-destructive/15 text-destructive",
};

function TransfersPage() {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { t } = useI18n();
  useRealtime(["transfers"]);
  const season = currentSeason();
  const { from, to } = seasonRange(season);
  const [kind, setKind] = useState<"all" | "player" | "coach">("all");

  const q = useQuery({
    queryKey: ["transfers", season],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .gte("moved_on", from)
        .lte("moved_on", to)
        .order("moved_on", { ascending: false, nullsFirst: false })
        .limit(300);
      const rows = (data ?? []) as Transfer[];
      const playerIds = rows.filter((r) => r.person_type === "player").map((r) => r.person_id);
      let people: Record<string, { id: string; name: string; photo_url: string | null }> = {};
      if (playerIds.length) {
        const { data: pl } = await supabase.from("players").select("id,name,photo_url").in("id", playerIds);
        people = Object.fromEntries((pl ?? []).map((p) => [p.id, p]));
      }
      const coachIds = rows.filter((r) => r.person_type === "coach").map((r) => r.person_id);
      if (coachIds.length) {
        const { data: co } = await supabase.from("coaches").select("id,name,photo_url").in("id", coachIds);
        for (const c of co ?? []) people[c.id] = c;
      }
      return rows.map((r) => ({ ...r, player: people[r.person_id] ?? null })) as Row[];
    },
  });

  const rows = useMemo(() => (q.data ?? []).filter((r) => kind === "all" || r.person_type === kind), [q.data, kind]);
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.moved_on ?? "undated";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <AppShell>
      <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
             <h1 className="text-2xl font-black tracking-tight">{t("nav.transfers")}</h1>
             <p className="text-xs text-muted-foreground">{tx("Season")} {tx(season)} · {rows.length} {tx("moves")}</p>
          </div>
        </div>
        <div className="mt-4 flex w-fit gap-1 rounded-full border border-border bg-background/70 p-1 text-xs">
          {(["all", "player", "coach"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 font-semibold capitalize ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
               {tx(k === "all" ? "All" : k === "player" ? "Players" : "Coaches")}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? <LoadingSkeleton /> : grouped.length === 0 ? (
        <EmptyState title={`${tx("No transfers yet")} — ${num(season)}`} />
      ) : (
        <div className="grid gap-6">
          {grouped.map(([day, list]) => (
            <section key={day}>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                  {day === "undated" ? tx("Date to be confirmed") : num(dates.date(day, { day: "numeric", month: "long", year: "numeric" }))}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {list.map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-bold">
                      {r.player?.photo_url ? <img src={r.player.photo_url} alt="" className="h-full w-full object-cover" /> : (r.player?.name ?? "?").slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">
                        {r.person_type === "player" && r.player
                          ? <Link to="/players/$id" params={{ id: r.person_id }} className="hover:text-primary">{tx(r.player.name)}</Link>
                          : (tx(r.player?.name) ?? tx("Unknown"))}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{tx(r.from_club) ?? "Free agent"}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate font-semibold text-foreground">{tx(r.to_club) ?? "—"}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {r.transfer_type && (
                        <span className={`rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider ${KIND_TONE[r.transfer_type] ?? "bg-primary/15 text-primary"}`}>
                           {tx(r.transfer_type)}
                        </span>
                      )}
                      {r.fee && <div className="mt-1 text-xs font-semibold tabular-nums">{r.fee}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}