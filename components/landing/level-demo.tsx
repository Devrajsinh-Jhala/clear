"use client";

import { Check, X } from "lucide-react";
import { useState, type CSSProperties } from "react";

// Hand-written samples of one idea at four of CLEAR's learner levels.
const LEVELS: Array<{ id: string; label: string; text: string }> = [
  {
    id: "beginner",
    label: "Beginner",
    text: "Think of a mailbox with a slot. Anyone can drop a letter in, but only the person with the key can take letters out. Your public key is the slot. Your private key opens the box.",
  },
  {
    id: "student",
    label: "Student",
    text: "You publish one key and keep the other secret. A message locked with your public key can only be opened with your private key, so a stranger can write to you safely without the two of you ever sharing a secret.",
  },
  {
    id: "engineer",
    label: "Engineer",
    text: "Each side holds a key pair. The sender encrypts a random session key with the recipient's public key, or both sides derive one with Diffie–Hellman. Only the private key recovers it, and the data itself then travels under a fast symmetric cipher such as AES.",
  },
  {
    id: "researcher",
    label: "Researcher",
    text: "Security rests on a trapdoor one-way function: easy to compute, infeasible to invert without secret information. RSA relies on factoring and elliptic-curve schemes on discrete logarithms. Shor's algorithm breaks both on a large quantum computer, which is why lattice-based schemes are replacing them.",
  },
];

const ANSWERS: Array<{ text: string; correct: boolean; feedback: string }> = [
  { text: "Read the messages other people send you.", correct: false, feedback: "Not quite. Reading needs your private key, and that never leaves you." },
  { text: "Lock a message that only you can open.", correct: true, feedback: "Correct. The public key only locks. Opening needs the private key." },
  { text: "Sign messages so they appear to come from you.", correct: false, feedback: "Not quite. Signing uses your private key. The public key only checks a signature." },
];

const SPARKS = [[-26, -18], [-8, -30], [14, -28], [28, -12], [24, 12], [-22, 14]];

/** One idea at four levels, then one question to check it clicked. Nothing here calls a model. */
export function LevelDemo() {
  const [level, setLevel] = useState(1);
  const [answer, setAnswer] = useState<number | null>(null);
  const chosen = answer === null ? null : ANSWERS[answer];

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="surface-panel flex flex-col p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">How does public-key encryption work?</p>
        <div role="group" aria-label="Learner level" className="mt-4 grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1 sm:inline-flex sm:w-fit">
          {LEVELS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === level}
              onClick={() => setLevel(index)}
              className={`rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${index === level ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p key={LEVELS[level].id} className="rise mt-6 min-h-[9.5rem] text-pretty text-lg leading-relaxed sm:min-h-[8rem] sm:text-xl sm:leading-relaxed" aria-live="polite">
          {LEVELS[level].text}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-6 text-xs text-muted-foreground">
          <span>Simpler</span>
          <span className="flex flex-1 gap-1" aria-hidden="true">
            {LEVELS.map((item, index) => (
              <span key={item.id} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index <= level ? "bg-primary" : "bg-border"}`} />
            ))}
          </span>
          <span>More exact</span>
        </div>
      </div>

      <div className="surface-panel flex flex-col p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Check it clicked</p>
        <fieldset className="mt-3">
          <legend className="text-pretty font-medium leading-snug">A stranger has your public key. What can they do with it?</legend>
          <div className="mt-4 space-y-2">
            {ANSWERS.map((item, index) => {
              const picked = answer === index;
              return (
                <button
                  key={item.text}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setAnswer(index)}
                  className={`relative flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors duration-200 ${picked ? item.correct ? "border-success/60 bg-success/8" : "border-destructive/50 bg-destructive/5" : "border-border hover:border-input hover:bg-muted/50"}`}
                >
                  <span className={`relative flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${picked ? item.correct ? "border-success bg-success text-background" : "border-destructive bg-destructive text-background" : "border-input"}`}>
                    {picked ? item.correct ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" /> : null}
                    {picked && item.correct ? SPARKS.map(([dx, dy], spark) => (
                      <span key={spark} aria-hidden="true" className="absolute size-1.5 rounded-full bg-success" style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, animation: "burst 0.6s ease-out both" } as CSSProperties} />
                    )) : null}
                  </span>
                  {item.text}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p role="status" className="mt-4 min-h-[3rem] text-sm leading-relaxed text-muted-foreground">
          {chosen ? <span key={answer} className="rise block text-foreground">{chosen.feedback}</span> : "Pick an answer. CLEAR ends every lesson with questions like this one."}
        </p>
      </div>
    </div>
  );
}
