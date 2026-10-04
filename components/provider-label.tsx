import { byokProviderLabel, parseStoredProvider } from "@/src/lib/ai/byok";
import { clearFreeModelLabel } from "@/src/lib/ai/models";

export function ProviderLabel({ provider, model }: { provider: string; model: string }) {
  const stored = parseStoredProvider(provider);
  if (provider === "sample") return <span>Sample lesson</span>;
  if (provider === "mock") return <span>Local mock provider · {model}</span>;
  if (stored.usesOwnKey) {
    return (
      <span>
        Your API · {byokProviderLabel(stored.adapterId)} · {model}
      </span>
    );
  }
  if (provider === "gemini") return <span>CLEAR Free · Gemini · {clearFreeModelLabel(model)}</span>;
  return (
    <span>
      {provider} · {model}
    </span>
  );
}
