export default function LearnLoading() {
  return (
    <div role="status" className="mx-auto grid max-w-6xl items-start gap-x-12 gap-y-6 px-4 py-8 sm:py-10 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
      <div className="hidden space-y-2 lg:block" aria-hidden="true">
        <div className="mb-6 h-10 animate-pulse rounded-lg bg-muted" />
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="h-7 animate-pulse rounded-md bg-muted" />)}
      </div>
      <div className="min-w-0 space-y-6">
        <p className="text-sm text-muted-foreground">Opening the lesson…</p>
        <div className="loading-beam rounded-full" aria-hidden="true" />
        <div className="space-y-4" aria-hidden="true">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
