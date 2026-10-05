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
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        className="bg-transparent text-foreground"
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
