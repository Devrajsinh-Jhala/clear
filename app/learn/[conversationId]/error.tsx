"use client";

import Link from "next/link";

export default function LessonError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <div className="surface-panel p-6 sm:p-8">
        <p className="eyebrow">Lesson unavailable</p>
        <h1 className="mt-3 font-serif text-3xl">The lesson could not be loaded.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">Your lesson storage may be temporarily unavailable. Try loading it again.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="button-primary text-sm">Try again</button>
          <Link href="/" className="button-secondary text-sm">Start a new lesson</Link>
        </div>
      </div>
    </section>
  );
}
