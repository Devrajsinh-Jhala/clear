"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useReducedMotion } from "@/components/landing/motion";

const HOLD_MS = 2400;
const TYPE_MS = 38;
const ERASE_MS = 16;

/**
 * An ask box that types example questions. It is one link: choosing it opens the
 * ask page with the question it is showing. With reduced motion it shows the first
 * question and stays still.
 */
export function HeroPrompt({ questions }: { questions: string[] }) {
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(questions[0].length);
  const [erasing, setErasing] = useState(false);
  const question = questions[index];

  useEffect(() => {
    if (still) return;
    const atEnd = shown === question.length;
    const delay = erasing ? ERASE_MS : atEnd ? HOLD_MS : TYPE_MS;
    const timer = window.setTimeout(() => {
      if (!erasing && atEnd) setErasing(true);
      else if (erasing && shown === 0) {
        setErasing(false);
        setIndex((current) => (current + 1) % questions.length);
      } else setShown((count) => count + (erasing ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [erasing, question, questions.length, shown, still]);

  return (
    <Link
      href={`/ask?q=${encodeURIComponent(question)}`}
      aria-label={`Ask: ${question}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card py-2 pl-4 pr-2 text-left shadow-[0_1px_2px_hsl(var(--shadow-color)/5%)] transition-colors hover:border-primary/50"
    >
      <span aria-hidden="true" className="min-w-0 flex-1 truncate text-[15px]">
        {still ? question : question.slice(0, shown)}
        {still ? null : <span className="caret" />}
      </span>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
