import { z } from "zod";

export const skillPreferencesSchema = z.object({
  level: z.enum(["beginner", "student", "engineer", "researcher", "interview"]).default("beginner"),
  depth: z.enum(["quick", "balanced", "deep"]).default("balanced"),
  analogies: z.enum(["when-useful", "avoid"]).default("when-useful"),
  visuals: z.enum(["when-useful", "text-only"]).default("when-useful"),
  interviewMode: z.boolean().default(false),
  quiz: z.boolean().default(true),
  verbosity: z.enum(["concise", "detailed"]).default("concise"),
}).strict();

export type SkillPreferences = z.infer<typeof skillPreferencesSchema>;

export const DEFAULT_SKILL_PREFERENCES: SkillPreferences = Object.freeze(
  skillPreferencesSchema.parse({}),
);

export const skillExportInputSchema = z.object({
  preferences: skillPreferencesSchema,
}).strict();
