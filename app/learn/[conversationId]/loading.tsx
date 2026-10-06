export default function LearnLoading() {
  return (
    <div role="status" className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="hidden space-y-4 lg:block" aria-hidden="true">
        <div className="h-11 animate-pulse rounded-full bg-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </div>
      <div className="min-w-0 space-y-6">
        <p className="eyebrow">CLEAR</p>
        <p className="font-heading text-4xl sm:text-5xl">Opening the lesson…</p>
        <div className="loading-beam rounded-full" aria-hidden="true" />
        <div className="space-y-4" aria-hidden="true">
          <div className="h-14 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
