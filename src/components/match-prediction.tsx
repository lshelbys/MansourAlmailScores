import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTx, useNum } from "@/lib/auto-translate";

type Choice = "home" | "draw" | "away";

/** "Who will win?" poll — every signed-in visitor gets one changeable vote. */
export function MatchPrediction({ matchId, homeLogo, awayLogo, fallback }: {
  matchId: string;
  homeLogo: string | null | undefined;
  awayLogo: string | null | undefined;
  fallback?: { home_percent: number; draw_percent: number; away_percent: number } | null;
}) {
  const tx = useTx();
  const num = useNum();
  const qc = useQueryClient();
  const { user } = useAuth();

  const votes = useQuery({
    queryKey: ["match-prediction-votes", matchId],
    queryFn: async () => ((await supabase.from("match_prediction_votes").select("choice,user_id").eq("match_id", matchId)).data ?? []) as { choice: string; user_id: string }[],
  });

  const rows = votes.data ?? [];
  const total = rows.length;
  const count = (choice: Choice) => rows.filter((row) => row.choice === choice).length;
  const mine = user ? rows.find((row) => row.user_id === user.id)?.choice as Choice | undefined : undefined;

  const pct = (choice: Choice) => {
    if (total > 0) return Math.round((count(choice) / total) * 100);
    if (!fallback) return 0;
    return choice === "home" ? fallback.home_percent : choice === "draw" ? fallback.draw_percent : fallback.away_percent;
  };

  const vote = async (choice: Choice) => {
    if (!user) return;
    if (mine === choice) await supabase.from("match_prediction_votes").delete().eq("match_id", matchId).eq("user_id", user.id);
    else await supabase.from("match_prediction_votes").upsert({ match_id: matchId, user_id: user.id, choice } as never, { onConflict: "match_id,user_id" });
    qc.invalidateQueries({ queryKey: ["match-prediction-votes", matchId] });
  };

  const options: [Choice, string, string | null | undefined][] = [
    ["home", tx("Home"), homeLogo],
    ["draw", tx("Draw"), null],
    ["away", tx("Away"), awayLogo],
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-bold">{tx("Who will win?")}</div>
        <div className="text-[0.65rem] text-muted-foreground">{num(total)} {tx("votes")}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map(([choice, label, logo]) => {
          const value = pct(choice);
          const active = mine === choice;
          return (
            <button
              key={choice}
              type="button"
              disabled={!user}
              onClick={() => vote(choice)}
              className={`overflow-hidden rounded-xl border p-2 text-center transition disabled:cursor-default ${active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}
            >
              <div className="flex h-8 items-center justify-center">{logo ? <img src={logo} alt={label} className="h-8 w-8 object-contain" /> : <span className="text-xs font-bold">{label}</span>}</div>
              <div className="mt-1 text-lg font-black tabular-nums">{num(value)}%</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      {!user && (
        <p className="mt-3 text-[0.65rem] text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary">{tx("Sign in")}</Link> {tx("to add your prediction.")}
        </p>
      )}
      {user && <p className="mt-3 text-[0.65rem] text-muted-foreground">{mine ? tx("Tap your pick again to remove it.") : tx("Tap a result to predict.")}</p>}
    </div>
  );
}
