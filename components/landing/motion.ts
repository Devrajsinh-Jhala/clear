"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(notify: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/** True on the server and for visitors who ask for less motion, so the still version is the default. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}

/**
 * Counts from 0 to `last`, one step every `everyMs`, then stops. With reduced
 * motion it reports the last step at once, so a staged demo shows its finished state.
 */
export function useStages(last: number, everyMs: number, still: boolean): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (still || stage >= last) return;
    const timer = window.setTimeout(() => setStage((current) => current + 1), everyMs);
    return () => window.clearTimeout(timer);
  }, [everyMs, last, stage, still]);
  return still ? last : stage;
}
