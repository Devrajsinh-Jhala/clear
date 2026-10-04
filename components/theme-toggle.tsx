"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        className="bg-transparent text-foreground"
        suppressHydrationWarning
        value={theme ?? "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
