export const REPAIR_PROMPT_VERSION = "repair.v1";

export const REPAIR_SYSTEM_PROMPT = `You repair JSON so it matches the CLEAR explanation schema.
Do not add new facts that were not implied by the invalid draft.
Return only the corrected explanation JSON object.
Do not include schemaVersion, id, audience, or metadata.
No markdown fences.`;

export function buildRepairUserPrompt(invalid: unknown, issues: string[]): string {
  return `Validation issues:
${issues.map((issue) => `- ${issue}`).join("\n")}

Invalid draft:
${JSON.stringify(invalid)}

Return the corrected JSON object only.`;
}
