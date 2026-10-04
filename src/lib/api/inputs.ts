import { z } from "zod";

import { depthSchema, learnerLevelSchema } from "@/src/lib/explanation/schema";

export const createExplanationInputSchema = z
  .object({
    question: z.string().trim().min(3).max(4000).optional(),
    level: learnerLevelSchema.default("student"),
    depth: depthSchema.default("balanced"),
    customLevel: z.string().trim().max(200).optional(),
    exampleId: z.literal("mutex").optional(),
  })
  .refine((value) => Boolean(value.exampleId || value.question), {
    message: "Enter a question or open the sample lesson.",
  });

export const teachBackInputSchema = z.object({
  explanation: z.string().trim().min(8).max(4000),
});

export const followUpInputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  activeView: z.string().trim().max(40).optional(),
});
