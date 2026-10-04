import { PageShell } from "@/components/page-shell";

export default function AboutPage() {
  return (
    <PageShell title="About" lede="CLEAR is a model-independent understanding layer for AI.">
      <p>
        A raw model answer can be correct and still hard to learn from. CLEAR turns that answer into one explanation document, then shows it as language, a mental model, a diagram, an example, and a check.
      </p>
      <p>Simplified Technical English inspired the demand for explicit language. It is not the product.</p>
    </PageShell>
  );
}
