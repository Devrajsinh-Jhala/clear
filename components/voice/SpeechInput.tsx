"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import type { RecognitionSession, RecognitionState } from "@/src/lib/voice/types";

const subscribeToSupport = () => () => {};
const serverSupport = () => 0;

function browserSupport() {
  if (typeof window === "undefined") return 0;
  const browser = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return 1 | (window.isSecureContext ? 2 : 0)
    | (typeof browser.SpeechRecognition === "function" || typeof browser.webkitSpeechRecognition === "function" ? 4 : 0);
}

interface InputOperation {
  stop(): void;
  abort(): void;
}

export function SpeechInput({
  onTranscript,
  disabled = false,
  label = "Speak a question",
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const support = useSyncExternalStore(subscribeToSupport, browserSupport, serverSupport);
  const [state, setState] = useState<RecognitionState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const disclosureId = useId();
  const mounted = useRef(false);
  const operation = useRef<InputOperation | null>(null);
  const transcriptCallback = useRef(onTranscript);
  const supported = (support & 7) === 7;
  const active = state === "starting" || state === "listening" || state === "stopping";

  useEffect(() => {
    transcriptCallback.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (disabled) operation.current?.abort();
  }, [disabled]);

  async function start() {
    if (disabled || !supported) return;
    operation.current?.abort();
    let canceled = false;
    let session: RecognitionSession | null = null;
    const current: InputOperation = {
      stop() {
        if (session) session.stop();
        else current.abort();
      },
      abort() {
        canceled = true;
        session?.abort();
        if (mounted.current && operation.current === current) {
          setState("idle");
          setInterim("");
        }
      },
    };
    operation.current = current;
    const isCurrent = () => mounted.current && !canceled && operation.current === current;
    setState("starting");
    setError("");
    setInterim("");
    try {
      const { getBrowserSpeechTransport } = await import("@/src/lib/voice/browser");
      if (!isCurrent()) return;
      session = getBrowserSpeechTransport().startRecognition({
        onState(next) { if (isCurrent()) setState(next); },
        onInterim(text) { if (isCurrent()) setInterim(text); },
        onFinal(text) { if (isCurrent()) transcriptCallback.current(text); },
        onError(failure) { if (isCurrent()) setError(failure.message); },
      });
    } catch (failure) {
      if (!isCurrent()) return;
      setState("error");
      setError(failure instanceof Error ? failure.message : "Speech input could not start. Try again or type your question.");
    }
  }

  const availability = !support
    ? "Checking microphone availability…"
    : !(support & 2)
      ? "Microphone input needs HTTPS or localhost. You can type your question."
      : !supported
        ? "This browser does not support speech input. You can type your question."
        : "Review the words in the text box before sending.";
  const status = state === "starting"
    ? "Starting the microphone…"
    : state === "listening"
      ? "Listening. Speak, then stop to review the text."
      : state === "stopping"
        ? "Finishing your words…"
        : availability;

  return (
    <div className="mt-3 space-y-2">
      <p id={disclosureId} className="max-w-2xl text-xs leading-relaxed text-muted">
        Speech input uses your browser&apos;s speech service, which may send audio to its provider. CLEAR stores only the text you choose to submit.
      </p>
      <button
        type="button"
        className="border border-line bg-card px-3 py-2 text-sm disabled:opacity-60"
        disabled={disabled || !supported || state === "stopping"}
        aria-describedby={disclosureId}
        aria-pressed={active}
        onClick={() => active ? operation.current?.stop() : void start()}
      >
        {active ? "Stop microphone" : state === "error" ? "Try microphone again" : label}
      </button>
      <p className="text-xs text-muted" role="status">{status}</p>
      {interim ? <p className="text-sm text-muted" aria-live="polite">Heard so far: {interim}</p> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
