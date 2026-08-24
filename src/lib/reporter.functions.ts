import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({ code: z.string().trim().min(4).max(40) });

/** A reporter redeems the access code the main admin sent them. */
export const redeemReporterCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("news_reporters")
      .select("id, access_code")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "no-application" };
    if (!row.access_code || row.access_code.trim().toUpperCase() !== data.code.toUpperCase()) {
      return { ok: false as const, reason: "invalid-code" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("news_reporters")
      .update({ status: "active", code_redeemed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true as const };
  });
