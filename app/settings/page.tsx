import { PageShell } from "@/components/page-shell";
import { LearningMemoryControl } from "@/components/settings/LearningMemoryControl";
import { ProviderKeys } from "@/components/settings/ProviderKeys";

export default function SettingsPage() {
  const freeReady = Boolean(process.env.GEMINI_API_KEY);
  return (
    <PageShell title="Settings" lede="The model is an implementation detail. CLEAR is the product.">
      <p>{freeReady ? "CLEAR Free is configured on this server." : "CLEAR Free is waiting for GEMINI_API_KEY in .env.local."}</p>
      <p>
        Your own keys stay encrypted on this server. The browser only sees the last four characters. If a saved key fails,
        CLEAR stops. It does not switch to CLEAR Free.
      </p>
      <ProviderKeys />
      <LearningMemoryControl />
    </PageShell>
  );
}
