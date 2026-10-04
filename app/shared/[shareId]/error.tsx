"use client";

import Link from "next/link";

export default function SharedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="eyebrow">Shared explanation</p>
      <h1 className="mt-3 font-serif text-4xl">The snapshot could not open</h1>
      <p role="alert" className="mt-4 leading-relaxed text-muted">Something interrupted this request. Try opening it again.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="button-primary">Try again</button>
        <Link href="/" className="button-secondary">Start your own lesson</Link>
      </div>
    </div>
  );
}
