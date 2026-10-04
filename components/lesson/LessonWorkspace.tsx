"use client";

import { useState } from "react";

import { DeepDiveView } from "@/components/lesson/DeepDiveView";
import { ExamplesView } from "@/components/lesson/ExamplesView";
import { InteractiveView } from "@/components/lesson/InteractiveView";
import { MentalModelView } from "@/components/lesson/MentalModelView";
import { QuizView } from "@/components/lesson/QuizView";
import { UnderstandView } from "@/components/lesson/UnderstandView";
import { VerifyView } from "@/components/lesson/VerifyView";
import { VisualView } from "@/components/lesson/VisualView";
import { ProviderLabel } from "@/components/provider-label";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ConversationMessage, ConversationRecord } from "@/src/lib/store/types";

const TABS = [
  ["understand", "Understand"],
  ["mental-model", "Mental Model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["examples", "Examples"],
  ["deep-dive", "Deep Dive"],
  ["verify", "Verify"],
  ["quiz", "Quiz"],
] as const;

type TabId = (typeof TABS)[number][0];

export function LessonWorkspace({ conversation }: { conversation: ConversationRecord }) {
  const [active, setActive] = useState<TabId>("understand");
  const [document, setDocument] = useState<ExplanationDocument | null>(conversation.document);
  const [messages, setMessages] = useState<ConversationMessage[]>(conversation.messages);
  const [provider, setProvider] = useState(conversation.activeProvider);
  const [model, setModel] = useState(conversation.activeModel);
  const [title, setTitle] = useState(conversation.title);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!document) {
    return <p>This lesson has no explanation yet.</p>;
  }

  async function sendFollowUp(message: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/explanations/${conversation.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, activeView: active }),
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
        return;
      }
      setDocument(payload.document);
      setMessages(payload.messages);
      setProvider(payload.activeProvider ?? provider);
      setModel(payload.activeModel ?? model);
      setTitle(payload.title ?? title);
      setDraft("");
    } catch {
      setError("The follow-up did not finish. Try again.");
    } finally {
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
      <div>
        <p className="text-sm text-muted">
          <ProviderLabel provider={provider} model={model} />
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">{title}</h1>
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
                  if (event.key === "ArrowRight") {
                    setActive(TABS[(index + 1) % TABS.length][0]);
                  }
                  if (event.key === "ArrowLeft") {
                    setActive(TABS[(index - 1 + TABS.length) % TABS.length][0]);
                  }
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
          {active === "interactive" ? <InteractiveView document={document} /> : null}
          {active === "examples" ? <ExamplesView document={document} /> : null}
          {active === "deep-dive" ? <DeepDiveView document={document} /> : null}
          {active === "verify" ? <VerifyView document={document} /> : null}
          {active === "quiz" ? <QuizView items={document.quiz} /> : null}
        </div>
        <section className="border-t border-line pt-6">
          <h2 className="font-serif text-2xl">Follow-up</h2>
          <ul className="mt-4 space-y-3">
            {messages.slice(2).map((message) => (
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
                    disabled={pending}
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
              if (draft.trim()) void sendFollowUp(draft.trim());
            }}
          >
            <label className="sr-only" htmlFor="follow-up">
              Ask a follow-up
            </label>
            <input
              id="follow-up"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a follow-up…"
              className="min-w-0 flex-1 border border-line bg-card px-3 py-3"
            />
            <button type="submit" disabled={pending || !draft.trim()} className="bg-accent px-4 py-3 text-accent-foreground disabled:opacity-50">
              {pending ? "Updating" : "Send"}
            </button>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
