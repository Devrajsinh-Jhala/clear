"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  ["/ask", "Ask"],
  ["/library", "Library"],
  ["/progress", "Progress"],
  ["/skill", "Skill"],
  ["/settings", "Settings"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="CLEAR home" className="rounded-lg">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="ml-6 hidden items-center gap-0.5 text-sm md:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${isActive(href) ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/auth" className="hidden rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-block">
            Account
          </Link>
          {pathname === "/ask" ? null : (
            <Link href="/ask" className="button-primary hidden !min-h-9 gap-1.5 !px-3.5 !py-1.5 text-sm sm:inline-flex">
              Ask a question
            </Link>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground md:hidden" aria-label="Open menu">
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-lg">Menu</SheetTitle>
                <SheetDescription className="sr-only">Pages in CLEAR</SheetDescription>
              </SheetHeader>
              <nav aria-label="Menu" className="flex flex-col gap-1 px-4 pb-6">
                {[...LINKS, ["/auth", "Account"] as const].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={`rounded-md px-3 py-2.5 text-base ${isActive(href) ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted"}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
