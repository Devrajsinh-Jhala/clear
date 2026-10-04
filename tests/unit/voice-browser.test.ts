import { describe, expect, it, vi } from "vitest";

import {
  chunkSpeechText,
  createBrowserSpeechTransport,
  getBrowserSpeechTransport,
  type BrowserRecognition,
  type BrowserSpeechEnvironment,
  type BrowserUtterance,
} from "@/src/lib/voice/browser";
import type { NarrationCallbacks, RecognitionCallbacks } from "@/src/lib/voice/types";

function fakeBrowser() {
  const recognitionInstances: FakeRecognition[] = [];
  const spoken: FakeUtterance[] = [];

  class FakeRecognition implements BrowserRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    maxAlternatives = 0;
    onstart: BrowserRecognition["onstart"] = null;
    onend: BrowserRecognition["onend"] = null;
    onerror: BrowserRecognition["onerror"] = null;
    onresult: BrowserRecognition["onresult"] = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();

    constructor() { recognitionInstances.push(this); }
  }

  class FakeUtterance implements BrowserUtterance {
    lang = "";
    onstart: BrowserUtterance["onstart"] = null;
    onend: BrowserUtterance["onend"] = null;
    onerror: BrowserUtterance["onerror"] = null;
    constructor(public text: string) {}
  }

  const synthesis = {
    paused: false,
    speak: vi.fn((utterance: BrowserUtterance) => spoken.push(utterance as FakeUtterance)),
    cancel: vi.fn(),
    pause: vi.fn(() => { synthesis.paused = true; }),
    resume: vi.fn(() => { synthesis.paused = false; }),
  };
  const environment: BrowserSpeechEnvironment = {
    isSecureContext: true,
    language: "en-IN",
    SpeechRecognition: FakeRecognition,
    SpeechSynthesisUtterance: FakeUtterance,
    speechSynthesis: synthesis,
  };
  return { environment, recognitionInstances, spoken, synthesis, FakeRecognition };
}

function recognitionCallbacks() {
  return {
    onState: vi.fn(),
    onFinal: vi.fn(),
    onInterim: vi.fn(),
    onError: vi.fn(),
  } satisfies RecognitionCallbacks;
}

function narrationCallbacks() {
  return { onState: vi.fn(), onError: vi.fn() } satisfies NarrationCallbacks;
}

function results(recognition: BrowserRecognition, segments: { text: string; final: boolean }[], resultIndex = 0) {
  recognition.onresult?.({
    resultIndex,
    results: segments.map((segment) => Object.assign([{ transcript: segment.text }], { isFinal: segment.final })),
  });
}

describe("browser speech recognition", () => {
  it("keeps provisional words out of the final transcript and delivers each result once", () => {
    const browser = fakeBrowser();
    const callbacks = recognitionCallbacks();
    const transport = createBrowserSpeechTransport(browser.environment);
    transport.startRecognition(callbacks);
    const recognition = browser.recognitionInstances[0];
    recognition.onstart?.();
    results(recognition, [{ text: " What is", final: false }]);
    expect(callbacks.onFinal).not.toHaveBeenCalled();
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("What is");

    results(recognition, [{ text: " What is a mutex? ", final: true }, { text: "How does", final: false }]);
    results(recognition, [{ text: "What is a mutex?", final: true }, { text: "How does it work?", final: true }], 1);
    results(recognition, [{ text: "What is a mutex?", final: true }, { text: "How does it work?", final: true }], 1);
    expect(callbacks.onFinal.mock.calls).toEqual([["What is a mutex?"], ["How does it work?"]]);
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("");
    expect(callbacks.onState.mock.calls).toEqual([["starting"], ["listening"]]);
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe("en-IN");
  });

  it("finishes captured words after an explicit stop", () => {
    const browser = fakeBrowser();
    const callbacks = recognitionCallbacks();
    const session = createBrowserSpeechTransport(browser.environment).startRecognition(callbacks);
    const recognition = browser.recognitionInstances[0];
    session.stop();
    session.stop();
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(callbacks.onState).toHaveBeenLastCalledWith("stopping");
    results(recognition, [{ text: "The final words", final: true }]);
    recognition.onend?.();
    expect(callbacks.onFinal).toHaveBeenCalledWith("The final words");
    expect(callbacks.onState).toHaveBeenLastCalledWith("idle");
    expect(recognition.onresult).toBeNull();
  });

  it("aborts immediately and ignores late events after cleanup", () => {
    const browser = fakeBrowser();
    const callbacks = recognitionCallbacks();
    const session = createBrowserSpeechTransport(browser.environment).startRecognition(callbacks);
    const recognition = browser.recognitionInstances[0];
    const lateResult = recognition.onresult;
    const lateError = recognition.onerror;
    session.abort();
    session.abort();
    lateResult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "Stale words" }], { isFinal: true })] });
    lateError?.({ error: "aborted" });
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(callbacks.onFinal).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onState).toHaveBeenLastCalledWith("idle");
    expect(callbacks.onInterim).toHaveBeenLastCalledWith("");
    expect(recognition.onerror).toBeNull();
  });

  it.each([
    ["not-allowed", "permission-denied"],
    ["service-not-allowed", "permission-denied"],
    ["audio-capture", "no-microphone"],
    ["network", "network"],
    ["no-speech", "no-speech"],
    ["language-not-supported", "language-unavailable"],
    ["unknown", "recognition-failed"],
  ])("reports %s with an actionable message and permits a new session", (browserError, expectedCode) => {
    const browser = fakeBrowser();
    const callbacks = recognitionCallbacks();
    const transport = createBrowserSpeechTransport(browser.environment);
    transport.startRecognition(callbacks);
    const recognition = browser.recognitionInstances[0];
    recognition.onerror?.({ error: browserError });
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: expectedCode, message: expect.any(String) }));
    expect(callbacks.onState).toHaveBeenLastCalledWith("error");
    expect(recognition.abort).toHaveBeenCalledOnce();
    transport.startRecognition(callbacks);
    expect(browser.recognitionInstances[1].start).toHaveBeenCalledOnce();
  });

  it("reports an empty recognition session instead of silently dropping it", () => {
    const browser = fakeBrowser();
    const callbacks = recognitionCallbacks();
    createBrowserSpeechTransport(browser.environment).startRecognition(callbacks);
    browser.recognitionInstances[0].onend?.();
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "no-speech" }));
  });

  it("maps a synchronous browser permission exception", () => {
    const browser = fakeBrowser();
    class DeniedRecognition extends browser.FakeRecognition {
      constructor() {
        super();
        this.start.mockImplementation(() => { throw new DOMException("Denied", "NotAllowedError"); });
      }
    }
    const callbacks = recognitionCallbacks();
    createBrowserSpeechTransport({ ...browser.environment, SpeechRecognition: DeniedRecognition }).startRecognition(callbacks);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "permission-denied" }));
  });

  it("supports the prefixed browser constructor", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport({ ...browser.environment, SpeechRecognition: undefined, webkitSpeechRecognition: browser.FakeRecognition });
    expect(transport.capabilities.recognition).toBe(true);
    transport.startRecognition(recognitionCallbacks(), { language: "en-GB" });
    expect(browser.recognitionInstances[0].lang).toBe("en-GB");
  });

  it("gates microphone use on a secure context and leaves typed input available", () => {
    const browser = fakeBrowser();
    const insecure = createBrowserSpeechTransport({ ...browser.environment, isSecureContext: false });
    expect(insecure.capabilities.recognition).toBe(false);
    expect(() => insecure.startRecognition(recognitionCallbacks())).toThrow("HTTPS or localhost");
    const unsupported = createBrowserSpeechTransport({ isSecureContext: true });
    expect(() => unsupported.startRecognition(recognitionCallbacks())).toThrow("type your question");
    expect(browser.recognitionInstances).toHaveLength(0);
    expect(() => getBrowserSpeechTransport()).toThrow("browser");
  });
});

describe("browser narration", () => {
  it("chunks a long explanation without losing words", () => {
    const text = "A mutex admits one thread. Other threads wait until it is released. ".repeat(30);
    const chunks = chunkSpeechText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 240)).toBe(true);
    expect(chunks.join(" ")).toBe(text.trim());
    expect(chunkSpeechText("   \n\t ")).toEqual([]);
    expect(chunkSpeechText("x".repeat(500)).map((chunk) => chunk.length)).toEqual([240, 240, 20]);
    expect(chunkSpeechText("A😀B😀C😀D", 4).join("")).toBe("A😀B😀C😀D");
  });

  it("queues one chunk at a time and completes the whole explanation", () => {
    const browser = fakeBrowser();
    const callbacks = narrationCallbacks();
    const text = "Each thread must acquire the mutex before entering the critical section. ".repeat(10);
    createBrowserSpeechTransport(browser.environment).narrate(text, callbacks);
    expect(browser.spoken).toHaveLength(1);
    expect(callbacks.onState).toHaveBeenLastCalledWith("starting");
    browser.spoken[0].onstart?.();
    expect(callbacks.onState).toHaveBeenLastCalledWith("speaking");
    const expected = chunkSpeechText(text);
    for (let index = 0; index < expected.length; index += 1) {
      expect(browser.spoken[index].text).toBe(expected[index]);
      browser.spoken[index].onend?.();
    }
    expect(browser.spoken).toHaveLength(expected.length);
    expect(browser.spoken[0].lang).toBe("en-IN");
    expect(callbacks.onState).toHaveBeenLastCalledWith("idle");
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("pauses and resumes, including between chunks", () => {
    const browser = fakeBrowser();
    const callbacks = narrationCallbacks();
    const session = createBrowserSpeechTransport(browser.environment).narrate("One thread holds the mutex. ".repeat(25), callbacks);
    session.pause();
    session.pause();
    expect(browser.synthesis.pause).toHaveBeenCalledOnce();
    expect(callbacks.onState).toHaveBeenLastCalledWith("paused");
    browser.spoken[0].onend?.();
    expect(browser.spoken).toHaveLength(1);
    session.resume();
    expect(browser.synthesis.resume).toHaveBeenCalledOnce();
    expect(browser.spoken).toHaveLength(2);
    expect(callbacks.onState).toHaveBeenLastCalledWith("speaking");
  });

  it("cancels narration and ignores late chunk events", () => {
    const browser = fakeBrowser();
    const callbacks = narrationCallbacks();
    const session = createBrowserSpeechTransport(browser.environment).narrate("A long explanation. ".repeat(40), callbacks);
    const oldEnd = browser.spoken[0].onend;
    const oldError = browser.spoken[0].onerror;
    const cancelCount = browser.synthesis.cancel.mock.calls.length;
    session.stop();
    session.stop();
    oldEnd?.();
    oldError?.({ error: "canceled" });
    expect(browser.synthesis.cancel.mock.calls.length).toBe(cancelCount + 1);
    expect(browser.spoken).toHaveLength(1);
    expect(callbacks.onState).toHaveBeenLastCalledWith("idle");
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("unpauses the browser after a paused narration is stopped and played again", () => {
    const browser = fakeBrowser();
    browser.synthesis.speak.mockImplementation((utterance) => {
      browser.spoken.push(utterance as (typeof browser.spoken)[number]);
      if (!browser.synthesis.paused) utterance.onstart?.();
      return browser.spoken.length;
    });
    const transport = createBrowserSpeechTransport(browser.environment);
    const first = narrationCallbacks();
    const session = transport.narrate("First explanation.", first);
    session.pause();
    session.stop();
    // The actual browser cancel() clears its queue, but does not clear pause.
    expect(browser.synthesis.paused).toBe(true);
    const second = narrationCallbacks();
    transport.narrate("Second explanation.", second);
    expect(browser.synthesis.paused).toBe(false);
    expect(browser.synthesis.resume).toHaveBeenCalledOnce();
    expect(second.onState).toHaveBeenLastCalledWith("speaking");
    expect(browser.spoken[1].text).toBe("Second explanation.");
  });

  it("reports playback failure and supports an explicit retry", () => {
    const browser = fakeBrowser();
    const callbacks = narrationCallbacks();
    const transport = createBrowserSpeechTransport(browser.environment);
    transport.narrate("A mutex controls access.", callbacks);
    browser.spoken[0].onerror?.({ error: "not-allowed" });
    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ code: "narration-failed", message: expect.stringContaining("Press Listen") }));
    expect(callbacks.onState).toHaveBeenLastCalledWith("error");
    transport.narrate("A mutex controls access.", callbacks);
    expect(browser.spoken).toHaveLength(2);
  });

  it("does not enqueue unavailable or empty narration", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport(browser.environment);
    expect(() => transport.narrate("   ", narrationCallbacks())).toThrow("no explanation");
    expect(browser.spoken).toHaveLength(0);
    const unsupported = createBrowserSpeechTransport({ isSecureContext: true });
    expect(unsupported.capabilities.narration).toBe(false);
    expect(() => unsupported.narrate("A mutex", narrationCallbacks())).toThrow("transcript");
  });
});

describe("speech session coordination", () => {
  it("stops the prior player before another starts and reports idle to it", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport(browser.environment);
    const first = narrationCallbacks();
    const second = narrationCallbacks();
    transport.narrate("First explanation. ".repeat(50), first);
    const oldEnd = browser.spoken[0].onend;
    transport.narrate("Second explanation.", second);
    oldEnd?.();
    expect(first.onState).toHaveBeenLastCalledWith("idle");
    expect(browser.spoken).toHaveLength(2);
    expect(browser.spoken[1].text).toBe("Second explanation.");
  });

  it("stops narration before microphone capture to avoid feedback", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport(browser.environment);
    const player = narrationCallbacks();
    transport.narrate("A mutex controls access.", player);
    const cancelCount = browser.synthesis.cancel.mock.calls.length;
    transport.startRecognition(recognitionCallbacks());
    expect(browser.synthesis.cancel.mock.calls.length).toBe(cancelCount + 1);
    expect(player.onState).toHaveBeenLastCalledWith("idle");
    expect(browser.recognitionInstances[0].start).toHaveBeenCalledOnce();
  });

  it("aborts microphone capture before narration starts", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport(browser.environment);
    const microphone = recognitionCallbacks();
    transport.startRecognition(microphone);
    transport.narrate("A mutex controls access.", narrationCallbacks());
    expect(browser.recognitionInstances[0].abort).toHaveBeenCalledOnce();
    expect(microphone.onState).toHaveBeenLastCalledWith("idle");
    expect(browser.recognitionInstances[0].onresult).toBeNull();
  });

  it("aborts a prior microphone session when a different control starts", () => {
    const browser = fakeBrowser();
    const transport = createBrowserSpeechTransport(browser.environment);
    const first = recognitionCallbacks();
    transport.startRecognition(first);
    transport.startRecognition(recognitionCallbacks());
    expect(browser.recognitionInstances[0].abort).toHaveBeenCalledOnce();
    expect(first.onState).toHaveBeenLastCalledWith("idle");
    expect(browser.recognitionInstances[1].start).toHaveBeenCalledOnce();
  });
});
