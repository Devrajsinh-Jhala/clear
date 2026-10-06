"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ReadOnlyLesson } from "@/components/lesson/ReadOnlyLesson";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";

export function LegacyLesson({ conversationId, document }: { conversationId: string; document: ExplanationDocument }) {
  const router = useRouter();
  const copying = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function makePrivateCopy() {
    if (copying.current) return;
    copying.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/explanations/${encodeURIComponent(conversationId)}/copy`, { method: "POST" });
      const payload = await response.json() as { conversationId?: string; error?: { message?: string } };
      if (!response.ok || !payload.conversationId) {
        throw new Error(payload.error?.message ?? "The private copy could not be created. Try again.");
      }
      router.push(`/learn/${encodeURIComponent(payload.conversationId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The private copy could not be created. Try again.");
      copying.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <section aria-label="Earlier lesson access" className="mx-auto max-w-6xl px-4 pt-8">
        <div className="surface-panel flex flex-col items-start justify-between gap-5 p-5 sm:flex-row sm:p-6">
          <div className="max-w-2xl">
            <p className="eyebrow">An earlier lesson</p>
            <h2 className="mt-2 font-heading text-xl">Keep learning in a private copy</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This lesson was created before browser ownership was added. Anyone with its address can read this version. Make a private copy for this browser to continue asking questions.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The copy contains the explanation only. Previous messages, uploads, provider connections, and learning records are not copied.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Future follow-ups start with CLEAR Free. You can choose a connected model for a later turn.</p>
            {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
            {pending ? <p role="status" className="mt-3 text-sm text-muted-foreground">Creating your copy…</p> : null}
          </div>
          <button type="button" disabled={pending} onClick={() => void makePrivateCopy()} className="button-primary shrink-0 text-sm">{pending ? "Creating copy…" : error ? "Retry private copy" : "Make a private copy"}</button>
        </div>
      </section>
      <ReadOnlyLesson document={document} />
    </>
  );
}
