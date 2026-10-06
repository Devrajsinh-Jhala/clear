import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReadOnlyLesson } from "@/components/lesson/ReadOnlyLesson";
import { readPublicShare } from "@/src/lib/sharing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared explanation · CLEAR",
  description: "A read-only explanation shared from CLEAR.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const snapshot = await readPublicShare(shareId);
  if (!snapshot) notFound();

  return (
    <>
      <ReadOnlyLesson document={snapshot.document} sharedAt={snapshot.sharedAt} />
      <section aria-label="Download shared explanation" className="mx-auto max-w-6xl px-4 pb-10">
        <div className="surface-panel flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="font-heading text-2xl">Keep a copy</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Downloads contain this shared snapshot. A downloaded file remains yours if this link is later revoked.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">PDFs include written diagram and interactive summaries. Characters the PDF font cannot display appear as Unicode codes; Markdown and JSON keep the original text.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["markdown", "json", "pdf"] as const).map((format) => (
              <a key={format} href={`/api/shared/${encodeURIComponent(shareId)}/export?format=${format}`} className="button-secondary text-sm" aria-label={`Download ${format === "markdown" ? "Markdown" : format.toUpperCase()}`}>{format === "markdown" ? "Markdown" : format.toUpperCase()}</a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
