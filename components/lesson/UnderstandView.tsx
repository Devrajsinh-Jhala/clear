import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function UnderstandView({ document }: { document: ExplanationDocument }) {
  return (
    <div className="space-y-8">
      <p className="font-heading text-3xl leading-snug sm:text-4xl">{document.essence}</p>
      <p className="max-w-3xl text-lg leading-relaxed">{document.whyItMatters}</p>
      {document.prerequisites.length > 0 ? (
        <section>
          <h2 className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Prerequisites</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {document.prerequisites.map((item) => (
              <li key={item.id} className="rounded-xl border border-border px-3 py-1 text-sm">
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {document.process ? (
        <section>
          <h2 className="font-heading text-2xl">{document.process.title}</h2>
          <ol className="mt-4 space-y-3">
            {document.process.steps.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[2.5rem_1fr] gap-3">
                <span className="font-heading text-xl text-primary">{index + 1}</span>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section>
        <h2 className="font-heading text-2xl">Concepts</h2>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {document.concepts.map((concept) => (
            <details key={concept.id} className="py-3">
              <summary className="cursor-pointer font-medium">{concept.name}</summary>
              <p className="mt-2 text-muted-foreground">{concept.definition}</p>
              <p className="mt-2">{concept.plainExplanation}</p>
              <p className="mt-2 text-sm text-muted-foreground">Why it matters: {concept.importance}</p>
            </details>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-heading text-2xl">Terminology</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {document.terminology.map((term) => (
            <div key={term.term} className="rounded-xl border border-border bg-card p-4">
              <dt className="font-medium">{term.term}</dt>
              <dd className="mt-2 text-muted-foreground">{term.definition}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
