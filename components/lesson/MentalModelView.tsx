import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function MentalModelView({ document }: { document: ExplanationDocument }) {
  const analogy = document.mentalModel.analogy;
  return (
    <div className="space-y-8">
      <p className="max-w-3xl font-heading text-3xl leading-snug">{document.mentalModel.intuition}</p>
      {analogy ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-warning">Mental model — analogy</p>
          <p className="mt-2 text-sm text-muted-foreground">This is an intuition aid, not a literal description.</p>
          <p className="mt-4 text-lg">{analogy.description}</p>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Analogy mapping</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 font-medium">Analogy</th>
                <th className="py-2 font-medium">Actual idea</th>
              </tr>
            </thead>
            <tbody>
              {analogy.mapping.map((item) => (
                <tr key={`${item.source}-${item.target}`} className="border-b border-border">
                  <td className="py-2 pr-4">{item.source}</td>
                  <td className="py-2">{item.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-5 font-medium">Where the analogy breaks</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {analogy.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {document.misconceptions.length > 0 ? (
        <section>
          <h2 className="font-heading text-2xl">Common wrong pictures</h2>
          <ul className="mt-4 space-y-4">
            {document.misconceptions.map((item) => (
              <li key={item.misconception} className="rounded-xl border border-border p-4">
                <p>{item.misconception}</p>
                <p className="mt-2 text-muted-foreground">{item.correction}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
