import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { LearningMemoryControl } from "@/components/settings/LearningMemoryControl";
import { ProviderKeys } from "@/components/settings/ProviderKeys";
import { RoutingControl } from "@/components/settings/RoutingControl";

export default function SettingsPage() {
  const freeReady = Boolean(process.env.GEMINI_API_KEY);
  return (
    <PageShell title="Settings" lede="Choose your models, learning preferences, and privacy controls.">
      <p>{freeReady ? "CLEAR Free is configured on this server." : "CLEAR Free is not available on this server yet. You can connect your own provider below."}</p>
      <p>
        Your own keys stay encrypted on this server. The browser only sees the last four characters. If a saved key fails,
        CLEAR stops unless you explicitly enable CLEAR Free fallback in model routing below.
      </p>
      <ProviderKeys />
      <RoutingControl />
      <LearningMemoryControl />
      <section className="surface-panel flex flex-wrap items-center justify-between gap-5 p-5">
        <div><h2 className="font-serif text-2xl">Take CLEAR with you</h2><p className="mt-2 max-w-md text-sm text-muted">Choose your teaching preferences and download them as a skill for your own agent.</p></div>
        <Link href="/skill" className="button-secondary text-sm">Configure skill</Link>
      </section>
    </PageShell>
  );
}
