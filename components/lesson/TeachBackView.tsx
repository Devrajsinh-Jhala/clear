"use client";

import { useState } from "react";

import type { TeachBackResult } from "@/src/lib/explanation/teach-back";

export function TeachBackView({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: TeachBackResult | null;
}) {
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<TeachBackResult | null>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/explanations/${conversationId}/teach-back`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ explanation }),
      });
      const payload = (await response.json()) as {
        result?: TeachBackResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.result) {
        setError(payload.error?.message ?? "CLEAR could not review that explanation.");
        return;
      }
      setResult(payload.result);
    } catch {
      setError("The review did not finish. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-muted">Explain the idea in your own words. CLEAR checks the mechanism, not your writing style.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="teach-back" className="font-serif text-2xl">
          Teach it back
        </label>
        <textarea
          id="teach-back"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={6}
          required
          minLength={8}
          className="mt-4 w-full border border-line bg-card p-3"
          placeholder="A mutex lets one thread into the critical section…"
        />
        <button type="submit" disabled={pending} className="mt-4 bg-accent px-4 py-2 text-accent-foreground disabled:opacity-60">
          {pending ? "Reviewing" : "Check my explanation"}
        </button>
      </form>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {result ? <TeachBackResultView result={result} /> : null}
    </div>
  );
}

function TeachBackResultView({ result }: { result: TeachBackResult }) {
  return (
    <section className="border border-line bg-card p-5" aria-live="polite">
      <h2 className="font-serif text-3xl">{result.headline}</h2>
      <p className="mt-2 text-sm text-muted">
        {result.source === "model"
          ? "Reviewed by the selected model."
          : "Checked against the lesson's concept names. A model did not review the wording."}
      </p>
      {result.missingConcepts.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-medium">Missing</h3>
          <ul className="mt-2 list-disc pl-5">
            {result.missingConcepts.map((concept) => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.misleadingStatements.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-medium">Slightly incorrect</h3>
          <ul className="mt-2 list-disc pl-5">
            {result.misleadingStatements.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 className="mt-5 font-medium">Repaired explanation</h3>
      <p className="mt-2 max-w-2xl leading-relaxed">{result.repairedExplanation}</p>
    </section>
  );
}
