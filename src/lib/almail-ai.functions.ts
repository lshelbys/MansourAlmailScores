import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { almailInputSchema, almailFixtureInputSchema, almailVenueInputSchema, almailTransferInputSchema, almailPlayerBatchInputSchema } from "./almail-ai.schemas";

export const createPlayerDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generatePlayerDraft } = await import("./almail-ai.server");
    return generatePlayerDraft(data.notes, data.images);
  });

export const createArticleDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateArticleDraft } = await import("./almail-ai.server");
    return generateArticleDraft(data.notes, data.images);
  });
export const createFixtureDraftsWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailFixtureInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateFixtureDrafts } = await import("./almail-ai.server");
    return generateFixtureDrafts(data.notes, data.images, data.teams);
  });

export const createVenueDraftWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailVenueInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateVenueDraft } = await import("./almail-ai.server");
    return generateVenueDraft(data.notes, data.images ?? []);
  });

export const createTransferDraftsWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailTransferInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generateTransferDrafts } = await import("./almail-ai.server");
    return generateTransferDrafts(data.notes, data.images ?? [], data.personName ?? "");
  });

export const createPlayerDraftsWithAlmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => almailPlayerBatchInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (error || !isAdmin) throw new Error("Administrator access required.");
    const { generatePlayerDrafts } = await import("./almail-ai.server");
    return generatePlayerDrafts(data.notes, data.images);
  });
