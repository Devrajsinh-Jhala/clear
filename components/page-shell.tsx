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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">{lede}</p>
      {children ? <div className="mt-10 space-y-4 leading-relaxed">{children}</div> : null}
    </div>
  );
}
