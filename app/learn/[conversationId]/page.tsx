import { notFound } from "next/navigation";

import { LessonWorkspace } from "@/components/lesson/LessonWorkspace";
import { getConversationStore } from "@/src/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = await getConversationStore().get(conversationId);
  if (!conversation?.document) notFound();
  return <LessonWorkspace conversation={conversation} />;
}
