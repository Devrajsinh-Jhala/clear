// The order matters: when the chosen model cannot answer, CLEAR Free asks the others in this order.
// Flash-Lite comes first because it answers most reliably on the free tier; the Flash models are
// newer but often overloaded there. Each model has its own free quota, so a longer list is more capacity.
export const CLEAR_FREE_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
] as const;

export type ClearFreeModelId = (typeof CLEAR_FREE_MODELS)[number]["id"];

const DEFAULT_MODEL: ClearFreeModelId = "gemini-3.5-flash-lite";

export function isClearFreeModel(model: string | undefined): model is ClearFreeModelId {
  return CLEAR_FREE_MODELS.some((item) => item.id === model);
}

export function defaultClearFreeModel(): ClearFreeModelId {
  const configured = process.env.GEMINI_MODEL;
  return isClearFreeModel(configured) ? configured : DEFAULT_MODEL;
}

export function resolveClearFreeModel(requested?: string): ClearFreeModelId {
  return isClearFreeModel(requested) ? requested : defaultClearFreeModel();
}

export function clearFreeModelLabel(model: string): string {
  return CLEAR_FREE_MODELS.find((item) => item.id === model)?.label ?? model;
}
