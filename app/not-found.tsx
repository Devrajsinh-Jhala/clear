import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="font-heading text-3xl">That page is not here.</h1>
      <p className="mt-4 text-muted-foreground">The lesson may have been removed, or the address is wrong.</p>
      <Link href="/ask" className="mt-6 inline-block text-primary">
        Ask a new question
      </Link>
    </div>
  );
}
