"use client";

import { useState } from "react";

import { SpeechInput } from "@/components/voice/SpeechInput";
import { SpeechPlayer } from "@/components/voice/SpeechPlayer";
import type { TeachBackResult } from "@/src/lib/explanation/teach-back";
import { appendTranscript, teachBackTranscript } from "@/src/lib/voice/transcript";

export function TeachBackView({
  conversationId,
  initial,
  lessonRevision,
  active = true,
  disabled = false,
  onPendingChange,
}: {
  conversationId: string;
  initial: TeachBackResult | null;
  lessonRevision: string;
  active?: boolean;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [explanation, setExplanation] = useState("");
  const [review, setReview] = useState({ revision: lessonRevision, result: initial });
  const result = review.revision === lessonRevision ? review.result : null;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (pending || disabled) return;
    setPending(true);
    onPendingChange?.(true);
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
      setReview({ revision: lessonRevision, result: payload.result });
    } catch {
      setError("The review did not finish. Try again.");
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-muted-foreground">Explain the idea in your own words. CLEAR checks the mechanism, not your writing style.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="teach-back" className="font-heading text-2xl">
          Teach it back
        </label>
        <textarea
          id="teach-back"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={6}
          required
          minLength={8}
          maxLength={4000}
          disabled={pending || disabled}
          className="field-control mt-4 w-full p-3"
          placeholder="A mutex lets one thread into the critical section…"
        />
        <SpeechInput disabled={!active || pending || disabled} label="Speak your explanation" onTranscript={(text) => setExplanation((current) => appendTranscript(current, text, 4000))} />
        <button type="submit" disabled={pending || disabled} className="button-primary mt-4">
          {pending ? "Reviewing" : "Check my explanation"}
        </button>
      </form>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {result ? <TeachBackResultView result={result} disabled={!active || pending || disabled} /> : null}
    </div>
  );
}

function TeachBackResultView({ result, disabled }: { result: TeachBackResult; disabled: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-background/60 p-5" aria-live="polite">
      <h2 className="font-heading text-3xl">{result.headline}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
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
      {result.memoryWarning ? <p role="status" className="mt-4 text-sm text-foreground">{result.memoryWarning}</p> : null}
      <div className="mt-5"><SpeechPlayer text={teachBackTranscript(result)} label="Listen to feedback" disabled={disabled} /></div>
    </section>
  );
}
