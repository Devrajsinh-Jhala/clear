import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function VerifyView({ document }: { document: ExplanationDocument }) {
  const verification = document.verification;
  return (
    <div className="space-y-6">
      {!verification.performed ? (
        <p className="rounded-xl border border-warning/50 bg-card p-4" role="status">
          {verification.required
            ? "This explanation may depend on current information. External verification was not enabled for this response."
            : "External verification was not performed. This lesson is a conceptual explanation."}
        </p>
      ) : null}
      <p>
        Confidence: <strong className="font-medium">{verification.confidence}</strong>
      </p>
      {verification.claims.length > 0 ? (
        <ul className="space-y-3">
          {verification.claims.map((claim) => (
            <li key={claim.statement} className="rounded-xl border border-border p-4">
              <p>{claim.statement}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {claim.status}
                {claim.note ? ` — ${claim.note}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {verification.caveats.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          {verification.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
