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
        <article key={visual.id} className="rounded-xl border border-border bg-background p-5 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{visual.type.replace(/-/g, " ")}</p>
          <h2 className="mt-2 font-heading text-xl">{visual.title}</h2>
          <p className="mt-4 leading-relaxed">{visual.textEquivalent}</p>
          {visual.mermaid ? <MermaidDiagram source={visual.mermaid} /> : null}
        </article>
      ))}
    </div>
  );
}
