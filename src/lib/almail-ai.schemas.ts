import { z } from "zod";

const imageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dataUrl: z.string().max(8_000_000).refine((value) => /^data:image\/(png|jpeg|webp);base64,/i.test(value), "Unsupported image"),
});

export const almailInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6),
});
export const almailFixtureInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6),
  teams: z.array(z.string().trim().min(1).max(160)).max(80),
});
export const almailVenueInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6).default([]),
});
export const almailTransferInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(6).default([]),
  personName: z.string().trim().max(160).default(""),
});

export const almailPlayerBatchInputSchema = z.object({
  notes: z.string().trim().max(10_000),
  images: z.array(imageSchema).max(20).default([]),
});
