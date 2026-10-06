import Link from "next/link";

export default function SharedNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="eyebrow">Shared explanation</p>
      <h1 className="mt-3 font-heading text-3xl">This link is unavailable</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">The lesson may no longer be shared, or this address may be incomplete.</p>
      <Link href="/ask" className="button-primary mt-6">Start your own lesson</Link>
    </div>
  );
}
