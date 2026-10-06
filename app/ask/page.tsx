import type { Metadata } from "next";

import { AskComposer } from "@/components/ask/AskComposer";
import { defaultClearFreeModel } from "@/src/lib/ai/models";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  const initialQuestion = typeof q === "string" ? q.slice(0, 4000) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="sr-only">Ask CLEAR</h1>
      <AskComposer defaultModel={defaultClearFreeModel()} initialQuestion={initialQuestion} />
      <ul className="mt-6 grid gap-x-6 gap-y-4 text-sm text-muted-foreground sm:grid-cols-3">
        <li><span className="block font-medium text-foreground">One explanation, ten views</span>Read it, see it, try it, then check it clicked.</li>
        <li><span className="block font-medium text-foreground">Follow-ups update the lesson</span>Ask again and the same lesson improves.</li>
        <li><span className="block font-medium text-foreground">Private to this browser</span>Nothing is shared until you share it.</li>
      </ul>
    </div>
  );
}
