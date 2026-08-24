import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unlockAdminSchema } from "./admin.schemas";
import { createHash, timingSafeEqual } from "node:crypto";

export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => unlockAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    const expected = process.env.ADMIN_UNLOCK_PASSWORD;
    const secondary = process.env.ADMIN_UNLOCK_PASSWORD_SECONDARY;
    if (!expected && !secondary) throw new Error("Admin password not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: limitError } = await supabaseAdmin.rpc("admin_unlock_allowed", { _uid: context.userId });
    if (limitError) throw new Error("Could not verify unlock attempts.");
    if (!allowed) return { ok: false as const, rateLimited: true as const };

    const suppliedHash = createHash("sha256").update(data.password, "utf8").digest();
    const candidates = [expected, secondary].filter((value): value is string => Boolean(value));
    const matches = candidates.some((candidate) => {
      const expectedHash = createHash("sha256").update(candidate, "utf8").digest();
      return timingSafeEqual(suppliedHash, expectedHash);
    });
    const { error: auditError } = await supabaseAdmin.rpc("record_admin_unlock_attempt", {
      _uid: context.userId,
      _succeeded: matches,
    });
    if (auditError) throw new Error("Could not record unlock attempt.");
    if (!matches) return { ok: false as const, rateLimited: false as const };

    await supabaseAdmin.rpc("grant_admin", { _uid: context.userId });
    return { ok: true as const, rateLimited: false as const };
  });