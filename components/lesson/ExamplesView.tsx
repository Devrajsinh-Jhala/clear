import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function ExamplesView({ document }: { document: ExplanationDocument }) {
  return (
    <div className="space-y-6">
      {document.examples.map((example) => (
        <article key={example.id} className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-xl">{example.title}</h2>
          <p className="mt-3">{example.setup}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            {example.walkthrough.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-muted-foreground">{example.takeaway}</p>
        </article>
      ))}
    </div>
  );
}
