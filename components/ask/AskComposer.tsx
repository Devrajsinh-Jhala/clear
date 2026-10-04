"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

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
  const [filesOpen, setFilesOpen] = useState(false);
  const [speechOpen, setSpeechOpen] = useState(false);
  const [fallbackAllowed, setFallbackAllowed] = useState(false);
  const attachmentsId = useId();
  const speechId = useId();

  useEffect(() => {
    void fetch("/api/routing")
      .then((response) => response.json())
      .then((payload: { available?: ApprovedTarget[]; preferences?: { auto?: boolean; fallbackAllowed?: boolean; defaultTarget?: { provider: "clear-free" | ByokProviderId } } }) => {
        const targets = payload.available ?? [];
        setAvailable(targets);
        setProvider(payload.preferences?.auto ? "auto" : payload.preferences?.defaultTarget?.provider ?? "clear-free");
        setFallbackAllowed(Boolean(payload.preferences?.fallbackAllowed));
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
    if (!list || loading) return;
    setFilesOpen(true);
    setFiles((current) => [...current, ...Array.from(list)].slice(0, 3));
  }

  async function submit(exampleId?: "mutex") {
    if (loading) return;
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

  const levelLabel = LEVEL_OPTIONS.find(([value]) => value === level)?.[1];
  const depthLabel = DEPTH_OPTIONS.find(([value]) => value === depth)?.[1];
  const providerLabel = provider === "auto"
    ? "Auto routing"
    : provider === "clear-free" ? "CLEAR Free" : byokProviderLabel(provider);
  const dataLabel = files.length ? "question and attached material" : "question";
  const destination = (id: string) => id === "clear-free" || id === "gemini"
    ? "Google Gemini"
    : id === "compatible" ? "your configured endpoint" : byokProviderLabel(id);
  const destinations = [...new Set([destination(provider), ...(compare && compareProvider ? [destination(compareProvider)] : [])])];
  const routingNotice = provider === "auto"
    ? `Auto routes your ${dataLabel} using the approved providers and rules in Settings.${compare && compareProvider ? ` Comparison also sends it to ${destination(compareProvider)}.` : ""}${fallbackAllowed ? " Your enabled fallback may send it to Google Gemini if the selected provider fails." : ""} The lesson shows the provider used.`
    : `Your ${dataLabel} goes to ${destinations.join(" and ")}${compare ? " for model comparison" : ""}.${fallbackAllowed && provider !== "clear-free" ? " Your enabled fallback may send it to Google Gemini if the selected provider fails." : ""}`;

  return (
    <form
      className="surface-panel min-w-0 overflow-hidden shadow-[0_18px_60px_rgba(28,25,21,0.05)]"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        addFiles(event.dataTransfer.files);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="p-5 sm:p-7">
        <p className="eyebrow mb-3">Start with a question</p>
        <label htmlFor="question" className="block font-serif text-2xl leading-tight tracking-tight sm:text-[1.75rem]">
          What are you trying to understand?
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (question.trim()) void submit();
            }
          }}
          rows={4}
          maxLength={4000}
          disabled={loading}
          required
          placeholder="Why does virtual memory exist?"
          className="mt-5 block min-h-32 w-full resize-y rounded-lg bg-transparent py-2 text-base leading-7 placeholder:text-muted/70"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button
            type="button"
            disabled={loading}
            aria-expanded={filesOpen}
            aria-controls={attachmentsId}
            onClick={() => setFilesOpen((current) => !current)}
            className="button-secondary gap-2 !px-3 !py-2 !text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m8 13 6.5-6.5a3 3 0 0 1 4.2 4.2L10 19.4a5 5 0 0 1-7.1-7.1L12 3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {files.length ? `${files.length} attachment${files.length === 1 ? "" : "s"}` : "Add material"}
          </button>
          <button
            type="button"
            disabled={loading}
            aria-expanded={speechOpen}
            aria-controls={speechId}
            onClick={() => setSpeechOpen((current) => !current)}
            className="button-secondary gap-2 !px-3 !py-2 !text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8" strokeLinecap="round" /></svg>
            {speechOpen ? "Close voice input" : "Use your voice"}
          </button>
          <span className="ml-auto hidden text-[11px] text-muted sm:block">Images, PDFs, or code</span>
        </div>
        <div id={speechId} hidden={!speechOpen} className="mt-3 rounded-xl border border-line bg-background/50 p-3">
          {speechOpen ? (
            <SpeechInput
              disabled={loading}
              label="Speak a question"
              onTranscript={(text) => setQuestion((current) => appendTranscript(current, text, 4000))}
            />
          ) : null}
        </div>
        <div id={attachmentsId} hidden={!filesOpen} className="mt-3 rounded-xl border border-dashed border-line bg-background/50 p-4">
            <label className="block text-sm font-medium">
              Drop an image or PDF here
              <span className="mt-1 block text-xs font-normal text-muted">Or choose up to 3 files to explain with your question.</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                multiple
                disabled={loading}
                className="mt-3 block max-w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-2 file:text-xs file:text-foreground"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {files.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 text-xs">
                    <span className="min-w-0 break-all">{file.name} <span className="text-muted">· {Math.ceil(file.size / 1024)} KB</span></span>
                    <button
                      type="button"
                      disabled={loading}
                      className="shrink-0 text-muted underline underline-offset-4 hover:text-foreground"
                      onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {files.some((file) => file.type === "application/pdf") ? (
              <fieldset disabled={loading} className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <legend className="mb-2 text-muted">PDF scope</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="pdf-scope" checked={pdfScope === "whole"} onChange={() => setPdfScope("whole")} />
                  Whole document
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="pdf-scope" checked={pdfScope === "pages"} onChange={() => setPdfScope("pages")} />
                  Selected pages
                </label>
                {pdfScope === "pages" ? (
                  <label className="flex w-full items-center gap-3">
                    Pages
                    <input
                      aria-label="PDF pages"
                      value={pdfPages}
                      onChange={(event) => setPdfPages(event.target.value)}
                      placeholder="1-3, 5"
                      className="field-control min-w-0 flex-1 !py-2"
                    />
                  </label>
                ) : null}
              </fieldset>
            ) : null}
        </div>
        <details className="group mt-5 rounded-xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs [&::-webkit-details-marker]:hidden">
            <span>
              <span className="font-medium">Explanation preferences</span>
              <span className="mt-1 block text-muted">{levelLabel} · {depthLabel} · {providerLabel}{compare ? " · Compare" : ""}</span>
            </span>
            <svg className="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </summary>
          <fieldset disabled={loading} className="space-y-5 border-t border-line p-4">
            <legend className="sr-only">Explanation preferences</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted">
                Learner level
                <select
                  aria-label="Learner level"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as LearnerLevel)}
                  className="field-control mt-2 w-full"
                >
                  {LEVEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted">
                Explanation depth
                <select
                  aria-label="Explanation depth"
                  value={depth}
                  onChange={(event) => setDepth(event.target.value as Depth)}
                  className="field-control mt-2 w-full"
                >
                  {DEPTH_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {level === "custom" ? (
                <label className="block text-xs text-muted sm:col-span-2">
                  Describe the learner
                  <input
                    value={customLevel}
                    onChange={(event) => setCustomLevel(event.target.value)}
                    placeholder="For example, a designer learning to code"
                    className="field-control mt-2 w-full"
                  />
                </label>
              ) : null}
            </div>
            <div className="border-t border-line pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-medium">Your model</p>
                <Link href="/settings" className="text-xs text-accent underline underline-offset-4">Manage providers</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  Provider
                  <select
                    aria-label="Explanation provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as "auto" | "clear-free" | ByokProviderId)}
                    className="field-control mt-2 w-full"
                  >
                    <option value="auto">Auto</option>
                    {provider !== "auto" && !available.some((item) => item.provider === provider) ? (
                      <option value={provider} disabled>{providerLabel} · unavailable</option>
                    ) : null}
                    {available.map((item) => (
                      <option key={item.provider} value={item.provider}>
                        {item.provider === "clear-free" ? item.label : `Your API · ${item.label}`}
                      </option>
                    ))}
                  </select>
                </label>
                {provider === "clear-free" ? (
                  <label className="block text-xs text-muted">
                    Model
                    <select
                      aria-label="CLEAR Free model"
                      value={model}
                      onChange={(event) => setModel(event.target.value as ClearFreeModelId)}
                      className="field-control mt-2 w-full"
                    >
                      {CLEAR_FREE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                ) : provider !== "auto" ? (
                  <div className="min-w-0 text-xs text-muted">
                    <p>Connected model</p>
                    <p className="mt-2 break-all rounded-xl border border-line bg-background px-3 py-2.5 text-foreground">
                      {available.find((item) => item.provider === provider)?.model ?? "Connect this provider in Settings"}
                    </p>
                  </div>
                ) : <p className="self-end text-xs leading-5 text-muted">Chooses from your approved providers and task rules.</p>}
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <label className="flex items-center gap-2 text-xs">
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
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-muted">
                    Second provider
                    <select
                      aria-label="Comparison provider"
                      value={compareProvider}
                      onChange={(event) => setCompareProvider(event.target.value)}
                      className="field-control mt-2 w-full"
                    >
                      {available.map((item) => <option key={item.provider} value={item.provider}>{item.label}</option>)}
                    </select>
                  </label>
                  {compareProvider === "clear-free" ? (
                    <label className="block text-xs text-muted">
                      Second model
                      <select
                        aria-label="Comparison CLEAR Free model"
                        value={compareModel}
                        onChange={(event) => setCompareModel(event.target.value as ClearFreeModelId)}
                        className="field-control mt-2 w-full"
                      >
                        {CLEAR_FREE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          </fieldset>
        </details>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="button-primary w-full gap-2 sm:w-auto">
            {loading ? "Building your lesson…" : "Help me understand"}
            {!loading ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
          </button>
          <button type="button" disabled={loading} onClick={() => void submit("mutex")} className="button-secondary w-full sm:w-auto">
            See an example
          </button>
          <span className="ml-auto hidden text-[11px] text-muted xl:block">⌘ / Ctrl + Enter</span>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted" role="status">
          {loading ? STAGES[stage] : routingNotice}
        </p>
        {!loading ? <p className="mt-1 text-[11px] leading-5 text-muted">The sample lesson stays on this server.</p> : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-danger/40 bg-background p-4 text-sm" role="alert">
            <p>{error}</p>
            {retryable ? (
              <button type="button" disabled={loading} className="mt-2 underline underline-offset-4" onClick={() => void submit()}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-line bg-background/50 px-5 py-4 sm:px-7">
        <p className="mb-3 text-xs text-muted">Need a starting point? Try asking…</p>
        <ul className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((example) => (
            <li key={example}>
              <button
                type="button"
                disabled={loading}
                className="rounded-lg border border-line bg-card px-3 py-2 text-left text-xs leading-5 text-muted transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-60"
                onClick={() => {
                  setQuestion(example);
                  document.getElementById("question")?.focus();
                }}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
