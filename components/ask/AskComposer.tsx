"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SpeechInput } from "@/components/voice/SpeechInput";
import { byokProviderLabel, type ByokProviderId } from "@/src/lib/ai/byok";
import type { ApprovedTarget } from "@/src/lib/routing/choose";
import { CLEAR_FREE_MODELS, type ClearFreeModelId } from "@/src/lib/ai/models";
import { DEPTH_OPTIONS, EXAMPLE_QUESTIONS, LEVEL_OPTIONS } from "@/src/lib/explanation/labels";
import type { Depth, LearnerLevel } from "@/src/lib/explanation/schema";
import { appendTranscript } from "@/src/lib/voice/transcript";

const STAGES = [
  "Understanding your question…",
  "Building the concept map…",
  "Creating your explanation…",
];

export function AskComposer({ defaultModel }: { defaultModel: ClearFreeModelId }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<LearnerLevel>("student");
  const [depth, setDepth] = useState<Depth>("balanced");
  const [model, setModel] = useState<ClearFreeModelId>(defaultModel);
  const [provider, setProvider] = useState<"auto" | "clear-free" | ByokProviderId>("auto");
  const [available, setAvailable] = useState<ApprovedTarget[]>([]);
  const [compare, setCompare] = useState(false);
  const [compareProvider, setCompareProvider] = useState("");
  const [compareModel, setCompareModel] = useState<ClearFreeModelId>(defaultModel);
  const [customLevel, setCustomLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pdfScope, setPdfScope] = useState<"whole" | "pages">("whole");
  const [pdfPages, setPdfPages] = useState("");

  useEffect(() => {
    void fetch("/api/routing")
      .then((response) => response.json())
      .then((payload: { available?: ApprovedTarget[]; preferences?: { auto?: boolean; defaultTarget?: { provider: "clear-free" | ByokProviderId } } }) => {
        const targets = payload.available ?? [];
        setAvailable(targets);
        setProvider(payload.preferences?.auto ? "auto" : payload.preferences?.defaultTarget?.provider ?? "clear-free");
        const other = targets.find((item) => item.provider !== "clear-free");
        setCompareProvider(other?.provider ?? "clear-free");
      })
      .catch(() => setAvailable([]));
  }, []);

  useEffect(() => {
    if (!loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setStage((current) => (current + 1) % STAGES.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [loading]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((current) => [...current, ...Array.from(list)].slice(0, 3));
  }

  async function submit(exampleId?: "mutex") {
    setLoading(true);
    setError("");
    setStage(0);
    try {
      const body = new FormData();
      if (!exampleId && question.trim()) body.set("question", question);
      body.set("level", level);
      body.set("depth", depth);
      body.set("provider", provider);
      if (provider === "clear-free") body.set("model", model);
      const saved = available.find((item) => item.provider === provider);
      if (provider !== "clear-free" && provider !== "auto" && saved) body.set("model", saved.model);
      if (compare && compareProvider) {
        body.set("compareProvider", compareProvider);
        if (compareProvider === "clear-free") body.set("compareModel", compareModel);
        const compared = available.find((item) => item.provider === compareProvider);
        if (compareProvider !== "clear-free" && compared) body.set("compareModel", compared.model);
      }
      if (level === "custom" && customLevel.trim()) body.set("customLevel", customLevel);
      if (exampleId) body.set("exampleId", exampleId);
      if (!exampleId) {
        for (const file of files) body.append("files", file);
        if (files.some((file) => file.type === "application/pdf")) {
          body.set("pdfScope", pdfScope);
          body.set("pdfPages", pdfPages);
        }
      }
      const response = await fetch("/api/explanations", { method: "POST", body });
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
        maxLength={4000}
        disabled={loading}
        required
        placeholder="Why does virtual memory exist?"
        className="mt-4 w-full resize-y bg-transparent text-lg outline-none placeholder:text-muted"
      />
      <SpeechInput disabled={loading} label="Speak a question" onTranscript={(text) => setQuestion((current) => appendTranscript(current, text, 4000))} />
      <div
        className="mt-4 border border-dashed border-line p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <label className="text-sm text-muted">
          Add an image or PDF
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            multiple
            className="mt-2 block text-foreground"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {file.name} · {Math.ceil(file.size / 1024)} KB
                </span>
                <button type="button" className="underline" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {files.some((file) => file.type === "application/pdf") ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <label>
              <input type="radio" name="pdf-scope" checked={pdfScope === "whole"} onChange={() => setPdfScope("whole")} /> Whole document
            </label>
            <label>
              <input type="radio" name="pdf-scope" checked={pdfScope === "pages"} onChange={() => setPdfScope("pages")} /> Selected pages
            </label>
            {pdfScope === "pages" ? (
              <label>
                Pages
                <input
                  value={pdfPages}
                  onChange={(event) => setPdfPages(event.target.value)}
                  placeholder="1-3, 5"
                  className="ml-2 border-b border-line bg-transparent"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
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
        <label className="text-sm text-muted">
          Provider
          <select
            aria-label="Explanation provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as "auto" | "clear-free" | ByokProviderId)}
            className="ml-2 bg-transparent text-foreground"
          >
            <option value="auto">Auto</option>
            {available.map((item) => (
              <option key={item.provider} value={item.provider}>
                {item.provider === "clear-free" ? item.label : `Your API · ${item.label}`}
              </option>
            ))}
          </select>
        </label>
        {provider === "clear-free" ? (
          <label className="text-sm text-muted">
            Model
            <select
              aria-label="CLEAR Free model"
              value={model}
              onChange={(event) => setModel(event.target.value as ClearFreeModelId)}
              className="ml-2 bg-transparent text-foreground"
            >
              {CLEAR_FREE_MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : provider !== "auto" ? (
          <span className="text-sm text-muted">
            Model {available.find((item) => item.provider === provider)?.model ?? byokProviderLabel(provider)}
          </span>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => {
              const next = event.target.checked;
              setCompare(next);
              if (!next) return;
              const primary = provider === "clear-free" ? model : defaultModel;
              if ((compareProvider || "clear-free") === "clear-free") {
                setCompareModel(primary === "gemini-2.5-flash" ? "gemini-3.5-flash" : "gemini-2.5-flash");
              }
            }}
          />
          Compare with another model
        </label>
        {compare ? (
          <>
            <label className="text-sm text-muted">
              Second model
              <select
                aria-label="Comparison provider"
                value={compareProvider}
                onChange={(event) => setCompareProvider(event.target.value)}
                className="ml-2 bg-transparent text-foreground"
              >
                {available.map((item) => (
                  <option key={item.provider} value={item.provider}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {compareProvider === "clear-free" ? (
              <label className="text-sm text-muted">
                Second CLEAR Free model
                <select
                  aria-label="Comparison CLEAR Free model"
                  value={compareModel}
                  onChange={(event) => setCompareModel(event.target.value as ClearFreeModelId)}
                  className="ml-2 bg-transparent text-foreground"
                >
                  {CLEAR_FREE_MODELS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
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
          : files.length > 0
            ? "CLEAR Free sends your question and these files to Google Gemini."
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
