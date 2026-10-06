import { PageShell } from "@/components/page-shell";
import { ChaiButton } from "@/components/support/chai-button";

export default function AboutPage() {
  return (
    <PageShell title="About" lede="CLEAR is a model-independent understanding layer for AI.">
      <p>
        A raw model answer can be correct and still hard to learn from. CLEAR turns that answer into one explanation document, then shows it as language, a mental model, a diagram, an example, and a check.
      </p>
      <p>Simplified Technical English inspired the demand for explicit language. It is not the product.</p>
      <section className="surface-panel !mt-10 flex flex-col items-start gap-4 p-6 sm:p-7" aria-labelledby="support-title">
        <h2 id="support-title" className="font-heading text-2xl">Support CLEAR</h2>
        <p className="text-muted-foreground">
          CLEAR is free and its source is open. If it helped you understand something, you can buy the maker a chai. Support is optional and unlocks nothing: CLEAR Free and your own keys work the same either way.
        </p>
        <ChaiButton />
      </section>
    </PageShell>
  );
}
