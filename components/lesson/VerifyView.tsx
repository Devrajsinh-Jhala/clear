import { ShieldAlert } from "lucide-react";

import type { ExplanationDocument } from "@/src/lib/explanation/schema";

type Verification = ExplanationDocument["verification"];

const CONFIDENCE: Record<Verification["confidence"], string> = {
  high: "border-success/40 bg-success/10 text-success",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
};

const CLAIM: Record<Verification["claims"][number]["status"], string> = {
  supported: "border-success/40 bg-success/10 text-success",
  uncertain: "border-warning/40 bg-warning/10 text-warning",
  unverified: "border-border bg-muted text-muted-foreground",
};

export function VerifyView({ document }: { document: ExplanationDocument }) {
  const verification = document.verification;
  return (
    <div className="space-y-6">
      {!verification.performed ? (
        <p className="flex gap-3 rounded-xl border border-warning/50 bg-warning/8 p-4" role="status">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {verification.required
              ? "This explanation may depend on current information. External verification was not enabled for this response."
              : "External verification was not performed. This lesson is a conceptual explanation."}
          </span>
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2">
        Confidence:
        <strong className={`rounded-full border px-2.5 py-0.5 text-sm font-medium capitalize ${CONFIDENCE[verification.confidence]}`}>{verification.confidence}</strong>
      </p>
      {verification.claims.length > 0 ? (
        <ul className="space-y-3">
          {verification.claims.map((claim) => (
            <li key={claim.statement} className="rounded-xl border border-border bg-background/50 p-4">
              <p className="leading-relaxed">{claim.statement}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className={`mr-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${CLAIM[claim.status]}`}>{claim.status}</span>
                {claim.note}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {verification.caveats.length > 0 ? (
        <section>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Caveats</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground marker:text-border">
            {verification.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
