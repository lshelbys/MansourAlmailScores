import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Flag, MessageCircle, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDates, useNum, useTx } from "@/lib/auto-translate";
import { getChatAuthorProfiles, postChatMessage, editChatMessage, reportChatMessage } from "@/lib/chat.functions";

type ChatMessage = { id: string; user_id: string; body: string; created_at: string; edited_at: string | null };

export function MatchChat({ matchId }: { matchId: string }) {
  const tx = useTx();
  const num = useNum();
  const dates = useDates();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const send = useServerFn(postChatMessage);
  const edit = useServerFn(editChatMessage);
  const report = useServerFn(reportChatMessage);
  const getAuthors = useServerFn(getChatAuthorProfiles);

  const chat = useQuery({
    queryKey: ["match-chat", matchId],
    queryFn: async () => ((await supabase.from("match_chat_messages").select("id,user_id,body,created_at,edited_at").eq("match_id", matchId).order("created_at").limit(200)).data ?? []) as ChatMessage[],
  });
  const authors = useQuery({
    enabled: (chat.data?.length ?? 0) > 0,
    queryKey: ["match-chat-authors", matchId, chat.data?.length ?? 0],
    queryFn: async () => {
      const ids = [...new Set((chat.data ?? []).map((c) => c.user_id))];
       return await getAuthors({ data: { ids } });
    },
  });

  const run = async (task: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await task();
      if (ok) setNotice(ok);
      await chat.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  };

  const time = (message: ChatMessage) => num(dates.date(message.created_at, { hour: "2-digit", minute: "2-digit" }));

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4" /> {tx("Match chat")}</h3>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-3">
        {chat.data?.map((message) => {
          const author = authors.data?.find((a) => a.id === message.user_id);
          const name = author?.display_name || tx("Supporter");
          const mine = user?.id === message.user_id;
          return (
            <div key={message.id} className="group flex items-start gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-bold">
                {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-primary">{name}</span>
                  <span className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">{time(message)}</span>
                  {message.edited_at && <span className="shrink-0 text-[0.65rem] text-muted-foreground">({tx("edited")})</span>}
                  <div className="relative ms-auto">
                    <button type="button" aria-label={tx("Message options")} onClick={() => setMenuFor(menuFor === message.id ? null : message.id)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {menuFor === message.id && (
                      <div className="absolute end-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card text-xs shadow-lg">
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent" onClick={async () => { await navigator.clipboard?.writeText(message.body); setMenuFor(null); setNotice(tx("Message copied")); }}>
                          <Copy className="h-3.5 w-3.5" /> {tx("Copy")}
                        </button>
                        {mine ? (
                          <>
                            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent" onClick={() => { setEditingId(message.id); setEditBody(message.body); setMenuFor(null); }}>
                              <Pencil className="h-3.5 w-3.5" /> {tx("Edit")}
                            </button>
                            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-destructive hover:bg-accent" onClick={async () => { setMenuFor(null); await run(async () => { const { error: delError } = await supabase.from("match_chat_messages").delete().eq("id", message.id); if (delError) throw new Error(delError.message); }); }}>
                              <Trash2 className="h-3.5 w-3.5" /> {tx("Delete")}
                            </button>
                          </>
                        ) : user ? (
                          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent" onClick={async () => {
                            setMenuFor(null);
                            const reason = window.prompt(tx("Tell the admin what is wrong with this message (optional)") ?? "") ?? "";
                            await run(() => report({ data: { messageId: message.id, reason } }), tx("Report sent to the admin"));
                          }}>
                            <Flag className="h-3.5 w-3.5" /> {tx("Report")}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                {editingId === message.id ? (
                  <form className="mt-1 flex gap-2" onSubmit={async (event) => {
                    event.preventDefault();
                    const next = editBody.trim();
                    if (!next) return;
                    await run(() => edit({ data: { messageId: message.id, body: next } }));
                    setEditingId(null);
                  }}>
                    <input className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm" value={editBody} maxLength={500} onChange={(e) => setEditBody(e.target.value)} />
                    <button disabled={busy} className="rounded bg-primary px-3 text-xs font-bold text-primary-foreground">{tx("Save")}</button>
                    <button type="button" className="text-xs font-semibold text-muted-foreground" onClick={() => setEditingId(null)}>{tx("Cancel")}</button>
                  </form>
                ) : (
                  <div className="break-words">{message.body}</div>
                )}
              </div>
            </div>
          );
        })}
        {chat.data?.length === 0 && <p className="text-sm text-muted-foreground">{tx("No messages yet.")}</p>}
      </div>

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      {notice && <div className="mt-2 text-xs text-primary">{notice}</div>}

      {user ? (
        <form className="mt-2 flex gap-2" onSubmit={async (event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          await run(async () => { await send({ data: { matchId, body: text } }); setBody(""); });
        }}>
          <input className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder={tx("Write a message…")} />
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{tx("Send")}
          </button>
        </form>
      ) : (
        <Link to="/auth" className="mt-2 block rounded-lg border border-border p-3 text-center text-sm font-semibold">{tx("Sign in to join the chat")}</Link>
      )}
    </div>
  );
}