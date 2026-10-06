import { KeyRound } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { LearningMemoryControl } from "@/components/settings/LearningMemoryControl";
import { ProviderKeys } from "@/components/settings/ProviderKeys";
import { RoutingControl } from "@/components/settings/RoutingControl";

export default function SettingsPage() {
  const freeReady = Boolean(process.env.GEMINI_API_KEY);
  return (
    <PageShell title="Settings" lede="Choose your models, learning preferences, and privacy controls.">
      <section className="flex gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-2 text-sm leading-relaxed">
          <p className="font-medium">{freeReady ? "CLEAR Free is configured on this server." : "CLEAR Free is not available on this server yet. You can connect your own provider below."}</p>
          <p className="text-muted-foreground">
            Your own keys stay encrypted on this server. The browser only sees the last four characters. If a saved key fails,
            CLEAR stops unless you explicitly enable CLEAR Free fallback in model routing below.
          </p>
        </div>
      </section>
      <ProviderKeys />
      <RoutingControl />
      <LearningMemoryControl />
      <section className="surface-panel flex flex-wrap items-center justify-between gap-5 p-5 sm:p-7">
        <div><h2 className="font-heading text-2xl">Take CLEAR with you</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Choose your teaching preferences and download them as a skill for your own agent.</p></div>
        <Link href="/skill" className="button-secondary text-sm">Configure skill</Link>
      </section>
    </PageShell>
  );
}
