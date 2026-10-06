"use client";

import { useState } from "react";

import { ProviderLabel } from "@/components/provider-label";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { CompareOption, CompareRating, LessonMeta } from "@/src/lib/routing/store";

const RATINGS: Array<[CompareRating, string]> = [
  ["clearer", "Clearer"],
  ["more-accurate", "More accurate"],
  ["prefer", "Prefer this"],
];

export function CompareView({
  conversationId,
  options,
  onUpdate,
}: {
  conversationId: string;
  options: CompareOption[];
  onUpdate: (meta: LessonMeta, chosen?: { document: ExplanationDocument; provider: string; model: string; title: string }) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function choose(optionId: string, body: { rating?: CompareRating; use?: boolean }) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/explanations/${conversationId}/preference`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId, ...body }),
      });
      const payload = (await response.json()) as {
        meta?: LessonMeta;
        document?: ExplanationDocument;
        activeProvider?: string;
        activeModel?: string;
        title?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.meta) {
        setError(payload.error?.message ?? "That choice did not save.");
        return;
      }
      onUpdate(
        payload.meta,
        body.use && payload.document && payload.activeProvider && payload.activeModel
          ? {
              document: payload.document,
              provider: payload.activeProvider,
              model: payload.activeModel,
              title: payload.title ?? payload.document.topic,
            }
          : undefined,
      );
    } catch {
      setError("That choice did not finish.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl">Compare</h2>
      <p className="text-sm text-muted-foreground">Same question, two models. These notes are your preference, not a score.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {options.map((option) => (
          <article key={option.id} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <ProviderLabel provider={option.provider} model={option.model} />
            {option.document ? (
              <>
                <p>{option.document.essence}</p>
                <p className="text-sm text-muted-foreground">{option.document.mentalModel.intuition}</p>
                <p className="text-sm">{option.document.examples[0]?.title}</p>
                <p className="text-sm text-muted-foreground">
                  {option.document.visualizations.length > 0 ? "Includes a diagram." : "No diagram in this version."}{" "}
                  {option.document.deepDive.length} deep-dive section{option.document.deepDive.length === 1 ? "" : "s"}.
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {RATINGS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={pending}
                      onClick={() => void choose(option.id, { rating: id })}
                      className={`rounded-full border px-3 py-1 transition-colors disabled:opacity-50 ${option.ratings.includes(id) ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
                    >
                      {option.ratings.includes(id) ? `${label} · saved` : label}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={pending} onClick={() => void choose(option.id, { use: true })} className="button-primary text-sm">
                  Use this version
                </button>
              </>
            ) : (
              <p className="text-sm text-destructive">{option.error ?? "This version did not arrive."}</p>
            )}
          </article>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
