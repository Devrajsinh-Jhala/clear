"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { DeepDiveView } from "@/components/lesson/DeepDiveView";
import { ExamplesView } from "@/components/lesson/ExamplesView";
import { InteractiveView } from "@/components/lesson/InteractiveView";
import { MentalModelView } from "@/components/lesson/MentalModelView";
import { QuizView } from "@/components/lesson/QuizView";
import { TeachBackView } from "@/components/lesson/TeachBackView";
import { UnderstandView } from "@/components/lesson/UnderstandView";
import { VerifyView } from "@/components/lesson/VerifyView";
import { VisualView } from "@/components/lesson/VisualView";
import { CompareView } from "@/components/lesson/CompareView";
import { ProviderLabel } from "@/components/provider-label";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ApprovedTarget } from "@/src/lib/routing/choose";
import type { LessonMeta } from "@/src/lib/routing/store";
import type { ConversationMessage, ConversationRecord } from "@/src/lib/store/types";

const VoiceTutorView = dynamic(() => import("@/components/lesson/VoiceTutorView").then((module) => module.VoiceTutorView), {
  loading: () => <p role="status">Preparing voice controls…</p>,
});

const TABS = [
  ["understand", "Understand"],
  ["mental-model", "Mental Model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["examples", "Examples"],
  ["deep-dive", "Deep Dive"],
  ["verify", "Verify"],
  ["quiz", "Quiz"],
  ["teach-back", "Teach it back"],
  ["voice", "Voice Tutor"],
] as const;

type TabId = (typeof TABS)[number][0];

export function LessonWorkspace({ conversation, meta }: { conversation: ConversationRecord; meta: LessonMeta }) {
  const [active, setActive] = useState<TabId>("understand");
  const [document, setDocument] = useState<ExplanationDocument | null>(conversation.document);
  const [messages, setMessages] = useState<ConversationMessage[]>(conversation.messages);
  const [provider, setProvider] = useState(conversation.activeProvider);
  const [model, setModel] = useState(conversation.activeModel);
  const [title, setTitle] = useState(conversation.title);
  const [draft, setDraft] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const reviewing = useRef(false);
  const [reviewPending, setReviewPending] = useState(false);
  const busy = pending || reviewPending;
  const [error, setError] = useState("");
  const [lessonMeta, setLessonMeta] = useState(meta);
  const [nextProvider, setNextProvider] = useState("same");
  const [targets, setTargets] = useState<ApprovedTarget[]>([]);

  useEffect(() => {
    void fetch("/api/routing")
      .then((response) => response.json())
      .then((payload: { available?: ApprovedTarget[] }) => setTargets(payload.available ?? []))
      .catch(() => setTargets([]));
  }, []);

  if (!document) {
    return <p>This lesson has no explanation yet.</p>;
  }

  async function sendFollowUp(message: string, view = active, turnProvider = nextProvider): Promise<boolean> {
    if (sending.current || reviewing.current) return false;
    sending.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/explanations/${conversation.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          activeView: view,
          provider: turnProvider === "same" ? undefined : turnProvider,
        }),
      });
      const payload = (await response.json()) as {
        document?: ExplanationDocument;
        messages?: ConversationMessage[];
        activeProvider?: string;
        activeModel?: string;
        title?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.document || !payload.messages) {
        setError(payload.error?.message ?? "The follow-up did not update the lesson.");
        return false;
      }
      setDocument(payload.document);
      setMessages(payload.messages);
      setProvider(payload.activeProvider ?? provider);
      setModel(payload.activeModel ?? model);
      setTitle(payload.title ?? title);
      return true;
    } catch {
      setError("The follow-up did not finish. Try again.");
      return false;
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block">
        <p className="text-sm uppercase tracking-[0.16em] text-muted">This lesson</p>
        <p className="mt-3 font-serif text-2xl leading-tight">{title}</p>
        <p className="mt-4 text-sm text-muted">
          Sign-in and a saved library come with accounts. This address reloads the lesson on this server.
        </p>
      </aside>
      <div className="min-w-0">
        <p className="text-sm text-muted">
          <ProviderLabel provider={provider} model={model} />
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">{title}</h1>
        {lessonMeta.fallbackNote ? <p className="mt-3 text-sm text-muted">{lessonMeta.fallbackNote}</p> : null}
        {lessonMeta.comparison && !lessonMeta.comparison.pickedId ? (
          <fieldset disabled={busy} className="mt-6">
            <CompareView
              conversationId={conversation.id}
              options={lessonMeta.comparison.options}
              onUpdate={(next, chosen) => {
                setLessonMeta(next);
                if (!chosen) return;
                setDocument(chosen.document);
                setProvider(chosen.provider);
                setModel(chosen.model);
                setTitle(chosen.title);
              }}
            />
          </fieldset>
        ) : null}
        {conversation.attachments && conversation.attachments.length > 0 ? (
          <ul className="mt-3 text-sm text-muted">
            {conversation.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.filename}
                {attachment.pageCount ? ` · ${attachment.pageCount} pages` : ""} · sent to the selected provider
              </li>
            ))}
          </ul>
        ) : null}
        <div role="tablist" aria-label="Explanation views" className="mt-6 flex gap-2 overflow-x-auto border-b border-line">
          {TABS.map(([id, label]) => {
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={selected}
                aria-controls={`panel-${id}`}
                tabIndex={selected ? 0 : -1}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm ${selected ? "border-accent text-foreground" : "border-transparent text-muted"}`}
                onClick={() => setActive(id)}
                onKeyDown={(event) => {
                  const index = TABS.findIndex(([tabId]) => tabId === active);
                  const nextIndex = event.key === "ArrowRight" ? (index + 1) % TABS.length
                    : event.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length
                    : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
                  if (nextIndex < 0) return;
                  event.preventDefault();
                  const next = TABS[nextIndex][0];
                  setActive(next);
                  window.document.getElementById(`tab-${next}`)?.focus();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="py-8">
          {active === "understand" ? <UnderstandView document={document} /> : null}
          {active === "mental-model" ? <MentalModelView document={document} /> : null}
          {active === "visual" ? <VisualView document={document} /> : null}
          {active === "interactive" ? <InteractiveView widgets={document.interactives} /> : null}
          {active === "examples" ? <ExamplesView document={document} /> : null}
          {active === "deep-dive" ? <DeepDiveView document={document} /> : null}
          {active === "verify" ? <VerifyView document={document} /> : null}
          {active === "quiz" ? <QuizView items={document.quiz} /> : null}
          <div hidden={active !== "teach-back"}>
            <TeachBackView conversationId={conversation.id} initial={null} lessonRevision={`${document.metadata.generatedAt}:${provider}:${model}`} active={active === "teach-back"} disabled={pending} onPendingChange={(value) => { reviewing.current = value; setReviewPending(value); }} />
          </div>
          {active === "voice" ? (
            <VoiceTutorView document={document} messages={messages} provider={provider} model={model} pending={busy} error={error} draft={voiceDraft} onDraftChange={setVoiceDraft} onSend={(message) => sendFollowUp(message, "voice", "same")} onTeachBack={() => setActive("teach-back")} />
          ) : null}
        </div>
        {active !== "voice" ? <section className="border-t border-line pt-6">
          <h2 className="font-serif text-2xl">Follow-up</h2>
          <ul className="mt-4 space-y-3">
            {messages
              .filter((message, index) => index > 1 && message.kind !== "teach-back")
              .map((message) => (
              <li key={message.id} className={message.role === "user" ? "text-muted" : ""}>
                <span className="mr-2 text-xs uppercase tracking-[0.14em] text-muted">
                  {message.role === "user" ? "You" : "CLEAR"}
                </span>
                {message.content}
              </li>
            ))}
          </ul>
          {document.followUpSuggestions.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {document.followUpSuggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    className="border border-line px-3 py-1 text-left text-sm"
                    disabled={busy}
                    onClick={() => void sendFollowUp(suggestion)}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) void sendFollowUp(draft.trim()).then((sent) => { if (sent) setDraft(""); });
            }}
          >
            <label className="sr-only" htmlFor="follow-up">
              Ask a follow-up
            </label>
            <input
              id="follow-up"
              value={draft}
              maxLength={2000}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a follow-up…"
              className="min-w-0 flex-1 border border-line bg-card px-3 py-3"
            />
            <label className="text-sm text-muted">
              Next turn
              <select
                aria-label="Provider for the next turn"
                value={nextProvider}
                disabled={busy}
                onChange={(event) => setNextProvider(event.target.value)}
                className="ml-2 bg-transparent text-foreground"
              >
                <option value="same">Keep this model</option>
                {targets.map((target) => (
                  <option key={target.provider} value={target.provider}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || !draft.trim()} className="bg-accent px-4 py-3 text-accent-foreground disabled:opacity-50">
              {busy ? "Updating" : "Send"}
            </button>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </section> : null}
      </div>
    </div>
  );
}
