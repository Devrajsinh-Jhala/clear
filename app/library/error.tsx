"use client";

export default function LibraryError({ reset }: { reset: () => void }) {
  return <section className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-heading text-2xl">Your library could not be reached</h1><p className="mt-4 text-muted-foreground">Please try again in a moment. Your lessons have not been changed.</p><button type="button" onClick={reset} className="button-primary mt-6">Try again</button></section>;
}
