"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
import { LessonTabs } from "@/components/lesson/LessonTabs";
import { ShareExportPanel } from "@/components/lesson/ShareExportPanel";
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
  const followUpInput = useRef<HTMLInputElement>(null);
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
    // Words typed before the page finished loading are already in the box. Hydrate with the
    // server's empty draft (so Send's disabled state matches the HTML), then pick them up here.
    const typed = followUpInput.current?.value;
    if (typed) setDraft((current) => current || typed);
  }, []);

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
    <div className="mx-auto grid max-w-6xl items-start gap-x-12 gap-y-6 px-4 py-8 sm:py-10 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
      <header className="min-w-0 lg:col-start-2">
        <p className="text-sm text-muted-foreground">
          {document.metadata.provider === "clear-copy" ? <>Private copy · Follow-ups: <ProviderLabel provider={provider} model={model} /></> : <ProviderLabel provider={provider} model={model} />}
        </p>
        <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {lessonMeta.fallbackNote ? <p className="mt-3 text-sm text-muted-foreground">{lessonMeta.fallbackNote}</p> : null}
      </header>
      <div className="min-w-0 space-y-4 lg:col-start-2">
        <ShareExportPanel conversationId={conversation.id} document={document} disabled={busy} />
        {lessonMeta.comparison && !lessonMeta.comparison.pickedId ? (
          <fieldset disabled={busy}>
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
          <ul className="text-sm text-muted-foreground">
            {conversation.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.filename}
                {attachment.pageCount ? ` · ${attachment.pageCount} pages` : ""} · sent to the selected provider
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="min-w-0 lg:sticky lg:top-24 lg:col-start-1 lg:row-span-4 lg:row-start-1">
        <Link href="/ask" className="button-secondary mb-6 hidden w-full gap-2 text-sm lg:flex">
          <Plus className="size-4" aria-hidden="true" /> New lesson
        </Link>
        <p className="mb-2 hidden px-2.5 text-xs font-medium text-muted-foreground lg:block">Views</p>
        <LessonTabs tabs={TABS} active={active} onChange={setActive} />
        {document.learningObjectives.length > 0 ? (
          <div className="mt-8 hidden lg:block">
            <p className="px-2.5 text-xs font-medium text-muted-foreground">Learning goals</p>
            <ul className="mt-3 space-y-2.5 px-2.5 text-sm leading-relaxed text-muted-foreground">
              {document.learningObjectives.map((objective) => <li key={objective.id}>{objective.statement}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
        <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="surface-panel min-w-0 p-5 sm:p-8 lg:col-start-2">
          <div key={active} className="animate-fade-in">
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
        </div>
        {active !== "voice" ? <section className="surface-panel min-w-0 p-5 sm:p-6 lg:col-start-2">
          <h2 className="text-lg font-semibold tracking-tight">Follow-up</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each answer updates this lesson instead of starting a new one.</p>
          <ul className="mt-4 space-y-3">
            {messages
              .filter((message, index) => (message.kind === "follow-up" || index > 1) && message.kind !== "teach-back")
              .map((message) => (
              <li key={message.id} className={`rounded-lg border px-4 py-3 leading-relaxed ${message.role === "user" ? "ml-auto w-fit max-w-[90%] border-primary/20 bg-accent" : "border-border bg-muted/50"}`}>
                <span className="mr-2 text-xs font-medium text-muted-foreground">
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
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
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
              ref={followUpInput}
              id="follow-up"
              value={draft}
              maxLength={2000}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a follow-up…"
              className="field-control min-w-0 flex-1"
            />
            <label className="text-sm text-muted-foreground">
              Next turn
              <select
                aria-label="Provider for the next turn"
                value={nextProvider}
                disabled={busy}
                onChange={(event) => setNextProvider(event.target.value)}
                className="field-control ml-2 max-w-full !min-h-0 !py-2"
              >
                <option value="same">Keep this model</option>
                {targets.map((target) => (
                  <option key={target.provider} value={target.provider}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || !draft.trim()} className="button-primary">
              {busy ? "Updating" : "Send"}
            </button>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </section> : null}
    </div>
  );
}
