import { PageShell } from "@/components/page-shell";

const PROVIDERS = [
  ["CLEAR Free", "Gemini on CLEAR's server key", true],
  ["Google Gemini", "Your own key", false],
  ["OpenAI", "Your own key", false],
  ["Anthropic", "Your own key", false],
  ["xAI", "Your own key", false],
  ["Custom OpenAI-compatible", "Your endpoint and key", false],
] as const;

export default function SettingsPage() {
  const freeReady = Boolean(process.env.GEMINI_API_KEY);
  return (
    <PageShell title="Settings" lede="The model is an implementation detail. CLEAR is the product.">
      <p>{freeReady ? "CLEAR Free is configured on this server." : "CLEAR Free is waiting for GEMINI_API_KEY in .env.local."}</p>
      <ul className="divide-y divide-line border-y border-line">
        {PROVIDERS.map(([name, detail, active]) => (
          <li key={name} className="flex items-center justify-between gap-4 py-3">
            <span>
              <span className="block">{name}</span>
              <span className="text-sm text-muted">{detail}</span>
            </span>
            <span className="text-sm text-muted">{active ? (freeReady ? "Active" : "Needs a key") : "Not connected yet"}</span>
          </li>
        ))}
      </ul>
      <p>Saved keys will be encrypted on the server and will not be sent back to the browser. That connection flow is next.</p>
    </PageShell>
  );
}
