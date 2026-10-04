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
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          CLEAR
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          {LINKS.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "text-foreground" : "text-muted"}
              >
                {label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
