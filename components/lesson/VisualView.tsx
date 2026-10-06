import { MermaidDiagram } from "@/components/diagrams/MermaidDiagram";
import { EmptyCopy } from "@/components/lesson/DeepDiveView";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function VisualView({ document }: { document: ExplanationDocument }) {
  if (document.visualizations.length === 0) {
    return <EmptyCopy>No diagram was needed for this explanation. The text in Understand is the full account.</EmptyCopy>;
  }
  return (
    <div className="space-y-6">
      {document.visualizations.map((visual) => (
        <article key={visual.id} className="rounded-2xl border border-border bg-background/50 p-5 sm:p-6">
          <p className="tone-text font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">{visual.type}</p>
          <h2 className="mt-2 font-heading text-2xl">{visual.title}</h2>
          <p className="mt-4 leading-relaxed">{visual.textEquivalent}</p>
          {visual.mermaid ? <MermaidDiagram source={visual.mermaid} /> : null}
        </article>
      ))}
    </div>
  );
}
