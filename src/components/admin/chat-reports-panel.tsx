import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Flag, Trash2, Check } from "lucide-react";
import { supabase } from "@/lib/db";
import { btnGhost } from "./ui";

type Report = {
  id: string;
  match_id: string;
  message_id: string | null;
  message_body: string;
  reason: string | null;
  status: string;
  created_at: string;
};

/** Reports supporters filed against match chat messages. */
export function ChatReportsPanel() {
  const qc = useQueryClient();
  const key = ["admin", "chat-reports"];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => ((await supabase.from("match_chat_reports").select("*").order("created_at", { ascending: false }).limit(200)).data ?? []) as Report[],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /><h2 className="font-bold">Reported chat messages</h2></div>
      <div className="grid gap-2">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${r.status === "open" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{r.status}</span>
              <Link to="/matches/$id" params={{ id: r.match_id }} className="font-semibold text-primary">Open match</Link>
            </div>
            <p className="mt-2 rounded bg-muted px-3 py-2">{r.message_body}</p>
            {r.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {r.reason}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {r.message_id && (
                <button className={btnGhost} onClick={async () => {
                  await supabase.from("match_chat_messages").delete().eq("id", r.message_id!);
                  await supabase.from("match_chat_reports").update({ status: "removed" }).eq("id", r.id);
                  refresh();
                }}><Trash2 className="h-3.5 w-3.5" /> Delete message</button>
              )}
              <button className={btnGhost} onClick={async () => { await supabase.from("match_chat_reports").update({ status: "reviewed" }).eq("id", r.id); refresh(); }}>
                <Check className="h-3.5 w-3.5" /> Mark reviewed
              </button>
              <button className={btnGhost} onClick={async () => { await supabase.from("match_chat_reports").delete().eq("id", r.id); refresh(); }}>
                <Trash2 className="h-3.5 w-3.5" /> Dismiss report
              </button>
            </div>
          </div>
        ))}
        {q.data && q.data.length === 0 && <div className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No chat reports yet.</div>}
      </div>
    </div>
  );
}