"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { NarrationSession, NarrationState } from "@/src/lib/voice/types";

const subscribeToSupport = () => () => {};
const serverSupport = () => 0;

function browserSupport() {
  if (typeof window === "undefined") return 0;
  return 1 | ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window ? 2 : 0);
}

interface PlaybackOperation {
  pause(): void;
  resume(): void;
  stop(): void;
}

export function SpeechPlayer({
  text,
  label = "Listen",
  disabled = false,
}: {
  text: string;
  label?: string;
  disabled?: boolean;
}) {
  const support = useSyncExternalStore(subscribeToSupport, browserSupport, serverSupport);
  const [state, setState] = useState<NarrationState>("idle");
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const operation = useRef<PlaybackOperation | null>(null);
  const supported = (support & 3) === 3;
  const active = state === "starting" || state === "speaking" || state === "paused";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.stop();
    };
  }, []);

  // A reply or canonical lesson update must not leave stale speech playing.
  useEffect(() => {
    operation.current?.stop();
  }, [text, disabled]);

  async function play() {
    if (disabled || !supported || !text.trim()) return;
    operation.current?.stop();
    let canceled = false;
    let session: NarrationSession | null = null;
    const current: PlaybackOperation = {
      pause() { session?.pause(); },
      resume() { session?.resume(); },
      stop() {
        canceled = true;
        session?.stop();
        if (mounted.current && operation.current === current) {
          setState("idle");
          setError("");
        }
      },
    };
    operation.current = current;
    const isCurrent = () => mounted.current && !canceled && operation.current === current;
    setError("");
    setState("starting");
    try {
      const { getBrowserSpeechTransport } = await import("@/src/lib/voice/browser");
      if (!isCurrent()) return;
      session = getBrowserSpeechTransport().narrate(text, {
        onState(next) { if (isCurrent()) setState(next); },
        onError(failure) { if (isCurrent()) setError(failure.message); },
      });
    } catch (failure) {
      if (!isCurrent()) return;
      setState("error");
      setError(failure instanceof Error ? failure.message : "Spoken playback could not start. Press Listen to try again.");
    }
  }

  const status = state === "starting"
    ? "Starting spoken playback…"
    : state === "speaking"
      ? "Reading aloud."
      : state === "paused"
        ? "Spoken playback is paused."
        : !support
          ? "Checking spoken playback availability…"
          : !supported
            ? "This browser does not support spoken playback. Read the transcript below."
            : !text.trim()
              ? "There is no explanation to read yet."
              : "Uses your browser's voice. Playback starts when you press Listen.";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!active ? (
          <button
            type="button"
            disabled={disabled || !supported || !text.trim()}
            className="button-secondary text-sm"
            onClick={() => void play()}
          >
            {state === "error" ? "Try listening again" : label}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={state === "starting"}
              className="button-secondary text-sm"
              onClick={() => state === "paused" ? operation.current?.resume() : operation.current?.pause()}
            >
              {state === "paused" ? "Resume" : "Pause"}
            </button>
            <button type="button" className="button-secondary text-sm" onClick={() => operation.current?.stop()}>
              Stop
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground" role="status">{status}</p>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <details className="rounded-lg border border-border bg-card/80 p-3">
        <summary className="cursor-pointer text-sm font-medium">Read the transcript</summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{text || "There is no explanation to read yet."}</p>
      </details>
    </div>
  );
}
