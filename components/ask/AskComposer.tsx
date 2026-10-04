"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DEPTH_OPTIONS, EXAMPLE_QUESTIONS, LEVEL_OPTIONS } from "@/src/lib/explanation/labels";
import type { Depth, LearnerLevel } from "@/src/lib/explanation/schema";

const STAGES = [
  "Understanding your question…",
  "Building the concept map…",
  "Creating your explanation…",
];

export function AskComposer() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<LearnerLevel>("student");
  const [depth, setDepth] = useState<Depth>("balanced");
  const [customLevel, setCustomLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);

  useEffect(() => {
    if (!loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setStage((current) => (current + 1) % STAGES.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function submit(exampleId?: "mutex") {
    setLoading(true);
    setError("");
    setStage(0);
    try {
      const response = await fetch("/api/explanations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: exampleId ? undefined : question,
          level,
          depth,
          customLevel: level === "custom" ? customLevel : undefined,
          exampleId,
        }),
      });
      const payload = (await response.json()) as {
        conversationId?: string;
        error?: { message?: string; retryable?: boolean };
      };
      if (!response.ok || !payload.conversationId) {
        setRetryable(Boolean(payload.error?.retryable));
        setError(payload.error?.message ?? "CLEAR could not build that explanation.");
        return;
      }
      router.push(`/learn/${payload.conversationId}`);
    } catch {
      setRetryable(true);
      setError("The request did not finish. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="border border-line bg-card p-4 shadow-[0_20px_60px_rgba(40,32,18,0.06)] sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="question" className="font-serif text-2xl">
        What are you trying to understand?
      </label>
      <textarea
        id="question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        rows={5}
        required
        placeholder="Why does virtual memory exist?"
        className="mt-4 w-full resize-y bg-transparent text-lg outline-none placeholder:text-muted"
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm text-muted">
          Level
          <select
            aria-label="Learner level"
            value={level}
            onChange={(event) => setLevel(event.target.value as LearnerLevel)}
            className="ml-2 bg-transparent text-foreground"
          >
            {LEVEL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Depth
          <select
            aria-label="Explanation depth"
            value={depth}
            onChange={(event) => setDepth(event.target.value as Depth)}
            className="ml-2 bg-transparent text-foreground"
          >
            {DEPTH_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {level === "custom" ? (
          <label className="text-sm text-muted">
            Describe the learner
            <input
              value={customLevel}
              onChange={(event) => setCustomLevel(event.target.value)}
              className="ml-2 border-b border-line bg-transparent text-foreground"
            />
          </label>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-accent px-4 py-2 text-accent-foreground disabled:opacity-60"
        >
          {loading ? "Building" : "Ask anything"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit("mutex")}
          className="border border-line px-4 py-2 disabled:opacity-60"
        >
          See an example
        </button>
        <p className="text-sm text-muted">Ctrl or Cmd + Enter</p>
      </div>
      <p className="mt-4 text-sm text-muted" role="status">
        {loading
          ? STAGES[stage]
          : "CLEAR Free sends a new question to Google Gemini. The sample lesson stays on this server."}
      </p>
      {error ? (
        <div className="mt-4 border border-danger/40 bg-background p-3 text-sm" role="alert">
          <p>{error}</p>
          {retryable ? (
            <button type="button" className="mt-2 underline" onClick={() => void submit()}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-6 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((example) => (
          <li key={example}>
            <button
              type="button"
              className="border border-line px-3 py-1 text-left text-sm text-muted"
              onClick={() => setQuestion(example)}
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
