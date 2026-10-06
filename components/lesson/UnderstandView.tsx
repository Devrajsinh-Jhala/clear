import { ChevronDown } from "lucide-react";

import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function UnderstandView({ document }: { document: ExplanationDocument }) {
  return (
    <div className="space-y-8">
      <p className="text-balance font-heading text-2xl leading-snug sm:text-[1.75rem]">{document.essence}</p>
      <p className="max-w-3xl text-lg leading-relaxed">{document.whyItMatters}</p>
      {document.prerequisites.length > 0 ? (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground">Prerequisites</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {document.prerequisites.map((item) => (
              <li key={item.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {document.process ? (
        <section>
          <h2 className="font-heading text-xl">{document.process.title}</h2>
          <ol className="mt-4 space-y-3">
            {document.process.steps.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[2rem_1fr] items-start gap-3">
                <span className="tone-bg tone-text inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold">{index + 1}</span>
                <p className="pt-0.5 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section>
        <h2 className="font-heading text-xl">Concepts</h2>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {document.concepts.map((concept) => (
            <details key={concept.id} className="group">
              <summary className="flex list-none items-center justify-between gap-3 py-3.5 font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                {concept.name}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="pb-4">
                <p className="text-muted-foreground">{concept.definition}</p>
                <p className="mt-2 leading-relaxed">{concept.plainExplanation}</p>
                <p className="mt-2 text-sm text-muted-foreground">Why it matters: {concept.importance}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-heading text-xl">Terminology</h2>
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
