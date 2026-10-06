"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);

  return (
    <label className="flex items-center">
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        className="h-9 rounded-full border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/50"
        disabled={!hydrated || !theme}
        value={hydrated ? theme ?? "system" : "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
