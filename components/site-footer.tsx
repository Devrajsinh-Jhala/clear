import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ChaiButton } from "@/components/support/chai-button";

const COLUMNS = [
  ["Learn", [["/ask", "Ask a question"], ["/library", "Library"], ["/progress", "Progress"]]],
  ["Build", [["/skill", "Portable skill"], ["/settings", "Providers and keys"], ["https://github.com/Devrajsinh-Jhala/clear", "Source on GitHub"]]],
  ["About", [["/about", "About"], ["/privacy", "Privacy"], ["/terms", "Terms"]]],
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="col-span-2 sm:col-span-1">
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">AI knows the answer. CLEAR helps you understand it.</p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-muted-foreground">CLEAR is free. If it helped you, you can say thanks.</p>
          <ChaiButton className="mt-3" />
        </div>
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="text-sm font-medium">{title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {links.map(([href, label]) => (
                <li key={href}>
                  {href.startsWith("http") ? (
                    <a href={href} rel="noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">{label}</a>
                  ) : (
                    <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground">Explanations can be wrong. Each lesson shows what was and was not verified.</p>
      </div>
    </footer>
  );
}
