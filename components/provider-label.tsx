import { clearFreeModelLabel } from "@/src/lib/ai/models";

export function ProviderLabel({ provider, model }: { provider: string; model: string }) {
  if (provider === "sample") return <span>Sample lesson</span>;
  if (provider === "mock") return <span>Local mock provider · {model}</span>;
  if (provider === "gemini") return <span>CLEAR Free · Gemini · {clearFreeModelLabel(model)}</span>;
  return (
    <span>
      {provider} · {model}
    </span>
  );
}
