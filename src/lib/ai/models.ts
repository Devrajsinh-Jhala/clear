export const CLEAR_FREE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
] as const;

export type ClearFreeModelId = (typeof CLEAR_FREE_MODELS)[number]["id"];

const DEFAULT_MODEL: ClearFreeModelId = "gemini-2.5-flash";

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
