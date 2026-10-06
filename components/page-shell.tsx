import type { ReactNode } from "react";

export function PageShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <div className="aurora h-72 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <h1 className="animate-fade-up font-heading text-4xl leading-[1.05] sm:text-6xl">{title}</h1>
        <p className="mt-5 animate-fade-up text-lg leading-relaxed text-muted-foreground [animation-delay:80ms]">{lede}</p>
        {children ? <div className="mt-10 animate-fade-up space-y-4 leading-relaxed [animation-delay:160ms]">{children}</div> : null}
      </div>
    </div>
  );
}
