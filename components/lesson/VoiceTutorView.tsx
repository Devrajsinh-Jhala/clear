"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { ProviderLabel } from "@/components/provider-label";
import { SpeechInput } from "@/components/voice/SpeechInput";
import { SpeechPlayer } from "@/components/voice/SpeechPlayer";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import type { ConversationMessage } from "@/src/lib/store/types";
import { appendTranscript, lessonTranscript, NARRATION_SECTIONS, type NarrationSection } from "@/src/lib/voice/transcript";

export function VoiceTutorView({ document, messages, provider, model, pending, error, draft, onDraftChange, onSend, onTeachBack }: {
  document: ExplanationDocument;
  messages: ConversationMessage[];
  provider: string;
  model: string;
  pending: boolean;
  error: string;
  draft: string;
  onDraftChange: Dispatch<SetStateAction<string>>;
  onSend: (message: string) => Promise<boolean>;
  onTeachBack: () => void;
}) {
  const [section, setSection] = useState<NarrationSection>("understand");
  const turns = messages.filter((message, index) => index > 1 && message.kind !== "teach-back");
  const latestReply = turns.findLast((message) => message.role === "assistant");

  async function send() {
    if (!draft.trim() || pending) return;
    if (await onSend(draft.trim())) onDraftChange("");
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl">Voice tutor</h2>
        <p className="mt-3 max-w-2xl text-muted">Listen to this lesson, then speak or type a follow-up. Review the words before sending. Each turn updates the same lesson.</p>
        <p className="mt-3 text-sm"><ProviderLabel provider={provider} model={model} /></p>
        <p className="mt-2 text-sm text-muted">Speech uses your browser. The explanation and follow-ups use the model shown above.</p>
        <button type="button" className="mt-3 text-sm underline" onClick={onTeachBack}>Try oral teach-it-back</button>
      </div>
      <section className="border border-line bg-card p-4 sm:p-5" aria-label="Lesson narration">
        <label className="text-sm" htmlFor="narration-section">Listen to</label>
        <select
          id="narration-section"
          value={section}
          onChange={(event) => setSection(event.target.value as NarrationSection)}
          className="ml-3 border border-line bg-card p-2"
        >
          {NARRATION_SECTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <div className="mt-4"><SpeechPlayer text={lessonTranscript(document, section)} label="Listen to lesson" disabled={pending} /></div>
      </section>
      <section aria-label="Voice conversation">
        <h3 className="font-serif text-2xl">Conversation transcript</h3>
        {turns.length ? (
          <ol className="mt-4 space-y-4">
            {turns.map((message) => (
              <li key={message.id} className="border-l-2 border-line pl-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">{message.role === "user" ? "You" : "CLEAR"}</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-muted">Your follow-ups and CLEAR’s replies will appear here.</p>}
        {latestReply ? <div className="mt-4"><SpeechPlayer text={latestReply.content} label="Listen to latest reply" disabled={pending} /></div> : null}
        <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label htmlFor="voice-follow-up" className="font-medium">Ask about this lesson</label>
          <textarea
            id="voice-follow-up"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={pending}
            placeholder="Which part should I picture first?"
            className="mt-3 w-full border border-line bg-card p-3"
          />
          <SpeechInput disabled={pending} label="Speak a follow-up" onTranscript={(text) => onDraftChange((current) => appendTranscript(current, text, 2000))} />
          <button type="submit" disabled={pending || !draft.trim()} className="mt-4 bg-accent px-4 py-2 text-accent-foreground disabled:opacity-60">
            {pending ? "Updating lesson…" : "Send follow-up"}
          </button>
          {pending ? <p className="mt-3 text-sm text-muted" role="status">The selected model is updating your lesson.</p> : null}
          {error ? <p className="mt-3 text-sm text-danger" role="alert">{error} Your words are still here. Send again to retry.</p> : null}
        </form>
      </section>
    </div>
  );
}
