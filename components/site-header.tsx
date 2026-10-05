"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  ["/library", "Library"],
  ["/progress", "Progress"],
  ["/skill", "Skill"],
  ["/settings", "Settings"],
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-2xl tracking-tight">
          <svg aria-hidden="true" className="text-accent" width="25" height="25" viewBox="0 0 28 28" fill="none"><rect x="2" y="2" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="1.4" /><path d="M8 9h12M8 14h9M8 19h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <span>CLEAR</span>
        </Link>
        <nav aria-label="Primary" className="order-3 flex w-full items-center justify-between gap-1 text-sm sm:order-none sm:ml-auto sm:w-auto">
          {LINKS.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2.5 py-2 transition-colors ${active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-background hover:text-foreground"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 pl-3 sm:ml-2 sm:border-l sm:border-line"><Link href="/auth" className="text-sm text-muted hover:text-foreground">Account</Link><ThemeToggle /></div>
      </div>
    </header>
  );
}
