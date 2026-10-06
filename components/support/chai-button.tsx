import { Coffee } from "lucide-react";

export const SUPPORT_URL = "https://buymeachai.ezee.li/Devraj";

/**
 * Optional support for the maker. It only links to the Buy Me a Chai page:
 * CLEAR takes no payment, loads nothing from that site, and unlocks nothing.
 */
export function ChaiButton({ className = "" }: { className?: string }) {
  return (
    <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={`chai-button group ${className}`}>
      <Coffee className="size-4 transition-transform group-hover:-rotate-12" aria-hidden="true" />
      Buy me a chai
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
