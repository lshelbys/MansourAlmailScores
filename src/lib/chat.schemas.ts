import { z } from "zod";

export const postChatSchema = z.object({
  matchId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const editChatSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const reportChatSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().trim().max(300).default(""),
});

export const chatAuthorsSchema = z.object({
  ids: z.array(z.string().uuid()).max(200),
});