import { notFound } from "next/navigation";

import { LessonWorkspace } from "@/components/lesson/LessonWorkspace";
import { LegacyLesson } from "@/components/lesson/LegacyLesson";
import { ClearError } from "@/src/lib/api/errors";
import { projectExplanation } from "@/src/lib/export/document";
import { readLessonMeta } from "@/src/lib/routing/store";
import { clientLesson, getReadableLesson } from "@/src/lib/sharing/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const access = await getReadableLesson(conversationId).catch((error: unknown) => {
    if (error instanceof ClearError && error.status === 404) return null;
    throw error;
  });
  if (!access?.record.document) notFound();
  if (access.legacy) {
    return <LegacyLesson conversationId={conversationId} document={projectExplanation(access.record.document)} />;
  }
  const conversation = clientLesson(access.record);
  const meta = await readLessonMeta(conversationId);
  return <LessonWorkspace conversation={conversation} meta={meta} />;
}
