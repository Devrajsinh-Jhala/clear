/** The CLEAR mark: one beam enters a prism and leaves as several views. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32" fill="none">
      <path d="M2 18.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <path d="M19.5 14 30 8.5" stroke="oklch(0.66 0.23 335)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.5 17.5H30" stroke="oklch(0.76 0.17 60)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m19.5 21 10.5 5.5" stroke="oklch(0.72 0.14 200)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.2 5.6a1.6 1.6 0 0 1 2.8 0l8.3 15.2a1.6 1.6 0 0 1-1.4 2.4H8.3a1.6 1.6 0 0 1-1.4-2.4L15.2 5.6Z" fill="var(--background)" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m11 18.5 5.6-10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-heading text-xl tracking-tight ${className}`}>
      <LogoMark />
      <span>CLEAR</span>
    </span>
  );
}
