import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="font-serif text-4xl">That page is not here.</h1>
      <p className="mt-4 text-muted">The lesson may have been removed, or the address is wrong.</p>
      <Link href="/" className="mt-6 inline-block text-accent">
        Ask a new question
      </Link>
    </div>
  );
}
