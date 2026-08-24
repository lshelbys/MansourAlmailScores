import { z } from "zod";

export const unlockAdminSchema = z.object({
  password: z.string().min(1).max(256),
});