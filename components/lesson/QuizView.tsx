"use client";

import { useState } from "react";

import { EmptyCopy } from "@/components/lesson/DeepDiveView";
import type { QuizItem } from "@/src/lib/explanation/schema";

export function QuizView({ items }: { items: QuizItem[] }) {
  if (items.length === 0) {
    return <EmptyCopy>This lesson has no check yet. Ask for a question when you want to test the idea.</EmptyCopy>;
  }
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <QuizCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function QuizCard({ item }: { item: QuizItem }) {
  const [choice, setChoice] = useState("");
  const [written, setWritten] = useState("");
  const [revealed, setRevealed] = useState(false);
  const expected = Array.isArray(item.correctAnswer) ? item.correctAnswer.join(" → ") : item.correctAnswer;
  const given = item.type === "short-answer" || item.type === "ordering" || item.type === "prediction" ? written : choice;
  const correct =
    typeof item.correctAnswer === "string"
      ? given.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase()
      : false;

  return (
    <article className="border border-line bg-card p-5">
      <h2 className="text-lg">{item.question}</h2>
      {item.options ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Answer choices</legend>
          {item.options.map((option) => (
            <label key={option} className="flex gap-2">
              <input
                type="radio"
                name={item.id}
                value={option}
                checked={choice === option}
                onChange={() => setChoice(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="mt-4 block text-sm text-muted">
          Your answer
          <textarea
            value={written}
            onChange={(event) => setWritten(event.target.value)}
            rows={3}
            className="mt-2 w-full border border-line bg-background p-2 text-foreground"
          />
        </label>
      )}
      <button
        type="button"
        className="mt-4 bg-accent px-3 py-2 text-accent-foreground"
        onClick={() => setRevealed(true)}
      >
        Check
      </button>
      {revealed ? (
        <div className="mt-4" role="status">
          <p>{item.options || typeof item.correctAnswer === "string" ? (correct ? "Correct." : "Not yet.") : "Compare your sequence with the expected order."}</p>
          <p className="mt-2">Expected: {expected}</p>
          <p className="mt-2 text-muted">{item.explanation}</p>
        </div>
      ) : null}
    </article>
  );
}
