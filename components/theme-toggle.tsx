"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

const OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/** A three-way radio group. The stored choice is unknown until the page hydrates. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const current = hydrated ? theme ?? "system" : null;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(index: number) {
    const next = (index + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex h-9 items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const checked = current === value;
        return (
          <button
            key={value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={!hydrated}
            tabIndex={checked || (current === null && index === 0) ? 0 : -1}
            onClick={() => setTheme(value)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              choose(index + step);
            }}
            className={`inline-flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-offset-1 ${checked ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
