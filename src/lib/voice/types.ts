/** Speech I/O stays separate from the model that produces the lesson or reply. */
export type RecognitionState = "idle" | "starting" | "listening" | "stopping" | "error";
export type NarrationState = "idle" | "starting" | "speaking" | "paused" | "error";

export type SpeechErrorCode =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "no-microphone"
  | "no-speech"
  | "network"
  | "language-unavailable"
  | "recognition-failed"
  | "narration-failed";

export interface SpeechError {
  code: SpeechErrorCode;
  message: string;
}

export interface SpeechCapabilities {
  recognition: boolean;
  narration: boolean;
  secureContext: boolean;
}

export interface RecognitionCallbacks {
  onState(state: RecognitionState): void;
  /** Provisional words are for display only; they must not be submitted. */
  onInterim(text: string): void;
  /** Each finalized segment is delivered once in this session. */
  onFinal(text: string): void;
  onError(error: SpeechError): void;
}

export interface RecognitionSession {
  /** Stop capture and let the service finish recognizing the captured words. */
  stop(): void;
  /** Discard provisional words and release capture immediately. */
  abort(): void;
}

export interface NarrationCallbacks {
  onState(state: NarrationState): void;
  onError(error: SpeechError): void;
}

export interface NarrationSession {
  pause(): void;
  resume(): void;
  stop(): void;
}

/** A future provider adapter can supply the same explicit speech controls. */
export interface SpeechTransport {
  readonly id: string;
  readonly capabilities: SpeechCapabilities;
  startRecognition(callbacks: RecognitionCallbacks, options?: { language?: string }): RecognitionSession;
  narrate(text: string, callbacks: NarrationCallbacks, options?: { language?: string }): NarrationSession;
}
