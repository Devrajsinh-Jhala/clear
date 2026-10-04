"use client";

import { useState } from "react";

import { EmptyCopy } from "@/components/lesson/DeepDiveView";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function InteractiveView({ document }: { document: ExplanationDocument }) {
  const widget = document.interactives.find((item) => item.type === "generic-step-flow");
  if (!widget) {
    return (
      <EmptyCopy>
        {document.interactives.length > 0
          ? "Interactive version not available for this concept yet."
          : "Interactive version not available for this concept yet. Use the process in Understand, or ask for a step-through."}
      </EmptyCopy>
    );
  }
  return <StepFlow title={widget.title} steps={widget.steps} />;
}

function StepFlow({
  title,
  steps,
}: {
  title: string;
  steps: { id: string; title: string; detail: string }[];
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return (
    <div className="border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Step {index + 1} of {steps.length}
      </p>
      <h3 className="mt-6 text-xl">{step.title}</h3>
      <p className="mt-2 max-w-2xl">{step.detail}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          className="border border-line px-3 py-2 disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((current) => current - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="bg-accent px-3 py-2 text-accent-foreground disabled:opacity-40"
          disabled={index === steps.length - 1}
          onClick={() => setIndex((current) => current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
