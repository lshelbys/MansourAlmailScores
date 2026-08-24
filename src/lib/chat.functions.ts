import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { postChatSchema, editChatSchema, reportChatSchema, chatAuthorsSchema } from "./chat.schemas";

export const getChatAuthorProfiles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => chatAuthorsSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin.rpc("chat_author_profiles", { _ids: data.ids });
    if (error) throw new Error("Could not load chat profiles.");
    return profiles ?? [];
  });

export const postChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => postChatSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { isMessageBlocked } = await import("./chat-moderation.server");
    if (await isMessageBlocked(data.body)) {
      throw new Error("This message was blocked by the chat moderator. Please keep it respectful.");
    }
    const { error } = await context.supabase
      .from("match_chat_messages")
      .insert({ match_id: data.matchId, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editChatSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { isMessageBlocked } = await import("./chat-moderation.server");
    if (await isMessageBlocked(data.body)) {
      throw new Error("This message was blocked by the chat moderator. Please keep it respectful.");
    }
    const { error } = await context.supabase
      .from("match_chat_messages")
      .update({ body: data.body, edited_at: new Date().toISOString() })
      .eq("id", data.messageId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reportChatSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: message, error: readError } = await context.supabase
      .from("match_chat_messages")
      .select("id,match_id,user_id,body")
      .eq("id", data.messageId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!message) throw new Error("That message is no longer available.");
    const { error } = await context.supabase.from("match_chat_reports").insert({
      message_id: message.id,
      match_id: message.match_id,
      author_id: message.user_id,
      reporter_id: context.userId,
      message_body: message.body,
      reason: data.reason || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });