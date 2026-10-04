import type { ExplanationDocument } from "@/src/lib/explanation/schema";

import { EmptyCopy } from "@/components/lesson/DeepDiveView";

export function VisualView({ document }: { document: ExplanationDocument }) {
  if (document.visualizations.length === 0) {
    return <EmptyCopy>No diagram was needed for this explanation. The text in Understand is the full account.</EmptyCopy>;
  }
  return (
    <div className="space-y-6">
      {document.visualizations.map((visual) => (
        <article key={visual.id} className="border border-line bg-card p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-muted">{visual.type}</p>
          <h2 className="mt-2 font-serif text-2xl">{visual.title}</h2>
          <p className="mt-4 leading-relaxed">{visual.textEquivalent}</p>
          {visual.mermaid ? (
            <pre className="mt-4 overflow-x-auto border border-line bg-background p-4 font-mono text-sm">
              {visual.mermaid}
            </pre>
          ) : null}
        </article>
      ))}
      <p className="text-sm text-muted">The paragraph is the accessible version of the diagram. A drawn diagram renderer is next.</p>
    </div>
  );
}
