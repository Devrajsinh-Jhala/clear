export const BYOK_PROVIDERS = [
  { id: "gemini", label: "Google Gemini", needsBaseUrl: false, modelPlaceholder: "gemini-2.5-flash" },
  { id: "openai", label: "OpenAI", needsBaseUrl: false, modelPlaceholder: "gpt-4.1-mini" },
  { id: "anthropic", label: "Anthropic", needsBaseUrl: false, modelPlaceholder: "claude-sonnet-4-5" },
  { id: "xai", label: "xAI", needsBaseUrl: false, modelPlaceholder: "grok-3" },
  { id: "compatible", label: "Custom OpenAI-compatible", needsBaseUrl: true, modelPlaceholder: "model-id" },
] as const;

export type ByokProviderId = (typeof BYOK_PROVIDERS)[number]["id"];

export function isByokProvider(value: string): value is ByokProviderId {
  return BYOK_PROVIDERS.some((provider) => provider.id === value);
}

export function byokProviderLabel(id: string): string {
  return BYOK_PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

export function encodeByokProvider(id: ByokProviderId): string {
  return `byok:${id}`;
}

export function parseStoredProvider(value: string): { adapterId: string; usesOwnKey: boolean } {
  if (value.startsWith("byok:")) {
    return { adapterId: value.slice("byok:".length), usesOwnKey: true };
  }
  return { adapterId: value, usesOwnKey: false };
}

export function assertModelId(model: string | undefined): string {
  const trimmed = model?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(trimmed)) {
    throw new Error("Enter a model id such as gpt-4.1-mini.");
  }
  return trimmed;
}
