"use client";

export default function AuthError({ reset }: { reset: () => void }) {
  return <section className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-serif text-3xl">Your account could not be opened</h1><p className="mt-4 text-muted">Please try again in a moment.</p><button type="button" className="button-primary mt-6" onClick={reset}>Try again</button></section>;
}
