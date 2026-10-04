import type {
  NarrationSession,
  RecognitionSession,
  SpeechError,
  SpeechTransport,
} from "@/src/lib/voice/types";

// Recognition is not included in every TypeScript DOM library and is prefixed
// in some browsers. Keep its small browser boundary out of product components.
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}

interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}

export interface BrowserRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface BrowserUtterance {
  text: string;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

export interface BrowserSynthesis {
  readonly paused: boolean;
  speak(utterance: BrowserUtterance): void;
  cancel(): void;
  pause(): void;
  resume(): void;
}

export interface BrowserSpeechEnvironment {
  isSecureContext: boolean;
  language?: string;
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
  SpeechSynthesisUtterance?: new (text: string) => BrowserUtterance;
  speechSynthesis?: BrowserSynthesis;
}

const recognitionErrors: Record<string, SpeechError> = {
  "not-allowed": {
    code: "permission-denied",
    message: "Microphone access was denied. Allow it in your browser's site settings, then try again. You can also type your question.",
  },
  "service-not-allowed": {
    code: "permission-denied",
    message: "Your browser blocked speech recognition. Check its site permissions, then try again or type your question.",
  },
  "audio-capture": {
    code: "no-microphone",
    message: "Your browser could not use a microphone. Check that one is connected and available, then try again.",
  },
  "no-speech": {
    code: "no-speech",
    message: "No words were recognized. Try again and speak clearly, or type your question.",
  },
  network: {
    code: "network",
    message: "The browser's speech service could not connect. Check your connection and try again, or type your question.",
  },
  "language-not-supported": {
    code: "language-unavailable",
    message: "Your browser's speech service does not support this language. You can type your question instead.",
  },
};

function recognitionError(code: string): SpeechError {
  return recognitionErrors[code] ?? {
    code: "recognition-failed",
    message: "Speech recognition stopped. Try again, or type your question.",
  };
}

function synchronousRecognitionError(error: unknown): SpeechError {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return recognitionError("not-allowed");
  if (name === "NotFoundError") return recognitionError("audio-capture");
  return recognitionError("unknown");
}

/** Bound utterance length, preferring complete sentences and then words. */
export function chunkSpeechText(text: string, maxCharacters = 240): string[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 2) throw new Error("Speech chunk size must be at least 2.");
  const chunks: string[] = [];
  let remaining = text.replace(/\s+/g, " ").trim();
  while (remaining.length > maxCharacters) {
    const candidate = remaining.slice(0, maxCharacters);
    const sentences = Array.from(candidate.matchAll(/[.!?](?:\s|$)/g));
    const lastSentence = sentences.at(-1);
    let boundary = lastSentence ? lastSentence.index + 1 : candidate.lastIndexOf(" ");
    if (boundary < maxCharacters / 3) boundary = candidate.lastIndexOf(" ");
    if (boundary <= 0) boundary = maxCharacters;
    const previous = remaining.charCodeAt(boundary - 1);
    if (previous >= 0xd800 && previous <= 0xdbff) boundary -= 1;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/** The injectable boundary lets tests exercise real session lifecycles. */
export function createBrowserSpeechTransport(environment: BrowserSpeechEnvironment): SpeechTransport {
  const Recognition = environment.SpeechRecognition ?? environment.webkitSpeechRecognition;
  const synthesis = environment.speechSynthesis;
  const Utterance = environment.SpeechSynthesisUtterance;
  let activeRecognition: RecognitionSession | null = null;
  let activeNarration: NarrationSession | null = null;

  return {
    id: "browser-speech",
    capabilities: {
      recognition: Boolean(Recognition) && environment.isSecureContext,
      narration: Boolean(synthesis && Utterance),
      secureContext: environment.isSecureContext,
    },

    startRecognition(callbacks, options) {
      if (!environment.isSecureContext) throw new Error("Microphone input needs HTTPS or localhost. You can type your question.");
      if (!Recognition) throw new Error("This browser does not support speech input. You can type your question.");
      activeNarration?.stop();
      activeRecognition?.abort();

      let recognition: BrowserRecognition;
      try {
        recognition = new Recognition();
      } catch (error) {
        callbacks.onState("error");
        callbacks.onError(synchronousRecognitionError(error));
        return { stop() {}, abort() {} };
      }
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options?.language ?? environment.language ?? "en-US";
      recognition.maxAlternatives = 1;
      let finished = false;
      let stopped = false;
      const finalized = new Set<number>();

      function detach() {
        recognition.onstart = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
      }

      function release() {
        finished = true;
        detach();
        if (activeRecognition === session) activeRecognition = null;
        callbacks.onInterim("");
      }

      function fail(error: SpeechError) {
        if (finished) return;
        release();
        try { recognition.abort(); } catch { /* The browser may already have ended capture. */ }
        callbacks.onState("error");
        callbacks.onError(error);
      }

      const session: RecognitionSession = {
        stop() {
          if (finished || stopped) return;
          stopped = true;
          callbacks.onState("stopping");
          try { recognition.stop(); } catch (error) { fail(synchronousRecognitionError(error)); }
        },
        abort() {
          if (finished) return;
          release();
          try { recognition.abort(); } catch { /* Capture may already be released. */ }
          callbacks.onState("idle");
        },
      };
      activeRecognition = session;
      recognition.onstart = () => {
        if (!finished && !stopped) callbacks.onState("listening");
      };
      recognition.onresult = (event) => {
        if (finished) return;
        const interim: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript.trim();
          if (!text) continue;
          if (result.isFinal) {
            if (index >= event.resultIndex && !finalized.has(index)) {
              finalized.add(index);
              callbacks.onFinal(text);
            }
          } else {
            interim.push(text);
          }
        }
        callbacks.onInterim(interim.join(" "));
      };
      recognition.onerror = (event) => fail(recognitionError(event.error));
      recognition.onend = () => {
        if (finished) return;
        if (finalized.size === 0) {
          fail(recognitionError("no-speech"));
          return;
        }
        release();
        callbacks.onState("idle");
      };
      callbacks.onState("starting");
      try { recognition.start(); } catch (error) { fail(synchronousRecognitionError(error)); }
      return session;
    },

    narrate(text, callbacks, options) {
      if (!synthesis || !Utterance) throw new Error("This browser does not support spoken playback. The transcript is available below.");
      const chunks = chunkSpeechText(text);
      if (!chunks.length) throw new Error("There is no explanation to read yet.");
      activeRecognition?.abort();
      activeNarration?.stop();
      // Clear any browser queue left over from a previous session on this page.
      synthesis.cancel();
      // cancel() leaves the global paused state intact; speak() also preserves it.
      if (synthesis.paused) synthesis.resume();
      let finished = false;
      let paused = false;
      let index = 0;
      let utterance: BrowserUtterance | null = null;

      function detach() {
        if (!utterance) return;
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
        utterance = null;
      }

      function release() {
        finished = true;
        detach();
        if (activeNarration === session) activeNarration = null;
      }

      function fail(code: string) {
        if (finished) return;
        release();
        synthesis!.cancel();
        callbacks.onState("error");
        callbacks.onError({
          code: "narration-failed",
          message: code === "not-allowed"
            ? "Your browser blocked spoken playback. Press Listen to try again; the transcript is available below."
            : "Spoken playback did not finish. Press Listen to try again; the transcript is available below.",
        });
      }

      function speakNext() {
        if (finished || paused) return;
        if (index >= chunks.length) {
          release();
          callbacks.onState("idle");
          return;
        }
        try {
          utterance = new Utterance!(chunks[index]);
          utterance.lang = options?.language ?? environment.language ?? "en-US";
          utterance.onstart = () => {
            if (!finished && !paused) callbacks.onState("speaking");
          };
          utterance.onend = () => {
            if (finished) return;
            detach();
            index += 1;
            speakNext();
          };
          utterance.onerror = (event) => fail(event.error);
          synthesis!.speak(utterance);
        } catch {
          fail("synthesis-unavailable");
        }
      }

      const session: NarrationSession = {
        pause() {
          if (finished || paused) return;
          paused = true;
          try {
            synthesis.pause();
            callbacks.onState("paused");
          } catch { fail("synthesis-unavailable"); }
        },
        resume() {
          if (finished || !paused) return;
          paused = false;
          try {
            synthesis.resume();
            callbacks.onState("speaking");
            if (!utterance) speakNext();
          } catch { fail("synthesis-unavailable"); }
        },
        stop() {
          if (finished) return;
          release();
          synthesis.cancel();
          callbacks.onState("idle");
        },
      };
      activeNarration = session;
      callbacks.onState("starting");
      speakNext();
      return session;
    },
  };
}

let browserTransport: SpeechTransport | undefined;

/** One coordinator for all mic and playback controls on the current page. */
export function getBrowserSpeechTransport(): SpeechTransport {
  if (typeof window === "undefined") throw new Error("Speech is available after this page opens in a browser.");
  if (!browserTransport) {
    const browser = window as unknown as BrowserSpeechEnvironment;
    browserTransport = createBrowserSpeechTransport({
      isSecureContext: window.isSecureContext,
      language: navigator.language,
      SpeechRecognition: browser.SpeechRecognition,
      webkitSpeechRecognition: browser.webkitSpeechRecognition,
      SpeechSynthesisUtterance: browser.SpeechSynthesisUtterance,
      speechSynthesis: browser.speechSynthesis,
    });
  }
  return browserTransport;
}
