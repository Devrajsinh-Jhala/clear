"use client";

import { CircleCheck, CircleDot, CircleX } from "lucide-react";
import { useState } from "react";

import { EmptyCopy } from "@/components/lesson/DeepDiveView";
import type { QuizItem } from "@/src/lib/explanation/schema";

export function QuizView({ items }: { items: QuizItem[] }) {
  if (items.length === 0) {
    return <EmptyCopy>This lesson has no check yet. Ask for a question when you want to test the idea.</EmptyCopy>;
  }
  return (
    <div className="space-y-6">
      {items.map((item, index) => (
        <QuizCard key={item.id} item={item} position={index + 1} count={items.length} />
      ))}
    </div>
  );
}

const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

function QuizCard({ item, position, count }: { item: QuizItem; position: number; count: number }) {
  const [choice, setChoice] = useState("");
  const [written, setWritten] = useState("");
  const [revealed, setRevealed] = useState(false);
  const expected = Array.isArray(item.correctAnswer) ? item.correctAnswer.join(" → ") : item.correctAnswer;
  const given = item.type === "short-answer" || item.type === "ordering" || item.type === "prediction" ? written : choice;
  const correct = typeof item.correctAnswer === "string" ? same(given, item.correctAnswer) : false;
  const graded = Boolean(item.options) || typeof item.correctAnswer === "string";
  const ResultIcon = !graded ? CircleDot : correct ? CircleCheck : CircleX;

  return (
    <article className="rounded-2xl border border-border bg-background/50 p-5 sm:p-6">
      {count > 1 ? <p className="tone-text font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Question {position} of {count}</p> : null}
      <h2 className={`text-lg font-medium leading-relaxed ${count > 1 ? "mt-2" : ""}`}>{item.question}</h2>
      {item.options ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Answer choices</legend>
          {item.options.map((option) => {
            const isAnswer = revealed && typeof item.correctAnswer === "string" && same(option, item.correctAnswer);
            const missed = revealed && choice === option && !isAnswer;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isAnswer
                    ? "border-success/60 bg-success/10"
                    : missed
                      ? "border-destructive/50 bg-destructive/8"
                      : "border-border bg-card hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/8"
                }`}
              >
                <input
                  type="radio"
                  name={item.id}
                  value={option}
                  checked={choice === option}
                  onChange={() => setChoice(option)}
                  className="mt-0.5"
                />
                <span className="leading-relaxed">{option}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <label className="mt-4 block text-sm text-muted-foreground">
          Your answer
          <textarea
            value={written}
            onChange={(event) => setWritten(event.target.value)}
            rows={3}
            className="field-control mt-2 w-full text-base"
          />
        </label>
      )}
      <button type="button" className="button-primary mt-5" onClick={() => setRevealed(true)}>
        Check
      </button>
      {revealed ? (
        <div
          className={`mt-5 flex gap-3 rounded-xl border p-4 ${!graded ? "border-border bg-card" : correct ? "border-success/50 bg-success/10" : "border-warning/50 bg-warning/10"}`}
          role="status"
        >
          <ResultIcon className={`mt-0.5 size-5 shrink-0 ${!graded ? "text-primary" : correct ? "text-success" : "text-warning"}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{graded ? (correct ? "Correct." : "Not yet.") : "Compare your sequence with the expected order."}</p>
            <p className="mt-1">Expected: {expected}</p>
            <p className="mt-2 text-muted-foreground">{item.explanation}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
