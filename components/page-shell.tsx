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
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-serif text-5xl">{title}</h1>
      <p className="mt-4 text-lg text-muted">{lede}</p>
      {children ? <div className="mt-8 space-y-4 leading-relaxed">{children}</div> : null}
    </div>
  );
}
