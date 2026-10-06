import type { Metadata } from "next";

import { AskComposer } from "@/components/ask/AskComposer";
import { defaultClearFreeModel } from "@/src/lib/ai/models";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  const initialQuestion = typeof q === "string" ? q.slice(0, 4000) : "";

  return (
    <div className="relative">
      <div className="aurora h-[28rem]" aria-hidden="true" />
      <div className="grid-fade" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <h1 className="sr-only">Ask CLEAR</h1>
        <div className="animate-fade-up">
          <AskComposer defaultModel={defaultClearFreeModel()} initialQuestion={initialQuestion} />
        </div>
        <ul className="mt-8 grid animate-fade-up gap-3 text-sm text-muted-foreground [animation-delay:150ms] sm:grid-cols-3">
          <li className="rounded-2xl border border-border bg-card/60 p-4"><span className="block font-medium text-foreground">One explanation, ten views</span>Read it, see it, try it, then check it clicked.</li>
          <li className="rounded-2xl border border-border bg-card/60 p-4"><span className="block font-medium text-foreground">Follow-ups update the lesson</span>Ask again and the same lesson improves.</li>
          <li className="rounded-2xl border border-border bg-card/60 p-4"><span className="block font-medium text-foreground">Private to this browser</span>Nothing is shared until you share it.</li>
        </ul>
      </div>
    </div>
  );
}
