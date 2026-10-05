"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ReadOnlyLesson } from "@/components/lesson/ReadOnlyLesson";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import { projectExplanation } from "@/src/lib/export/document";
import type { ShareStatus } from "@/src/lib/sharing/types";

type Format = "markdown" | "json" | "pdf";
const FORMATS = [["markdown", "Markdown"], ["json", "JSON"], ["pdf", "PDF"]] as const;

export function ShareExportPanel({ conversationId, document, disabled }: {
  conversationId: string;
  document: ExplanationDocument;
  disabled: boolean;
}) {
  const [share, setShare] = useState<ShareStatus | null>(null);
  const [requestLoading, setRequestLoading] = useState(true);
  const [loadedDocument, setLoadedDocument] = useState<ExplanationDocument | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showProvider, setShowProvider] = useState(false);
  const [exportProvider, setExportProvider] = useState(false);
  const [shareError, setShareError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [downloaded, setDownloaded] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [origin, setOrigin] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const mutationLock = useRef(false);
  const downloadLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previewTitle = useId();
  const previewDocument = useMemo(() => projectExplanation(document, { includeProvider: showProvider }), [document, showProvider]);
  const loading = requestLoading || loadedDocument !== document;
  const locked = disabled || sharing || loading;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/explanations/${conversationId}/share`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { share?: ShareStatus; error?: { message?: string } };
        if (!response.ok || !payload.share) throw new Error(payload.error?.message ?? "Sharing settings could not be loaded.");
        if (controller.signal.aborted) return;
        setOrigin(window.location.origin);
        setShareError("");
        setCopied(false);
        setShare(payload.share);
        setShowProvider(Boolean(payload.share.showProvider));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setShare(null);
        setShareError(error instanceof Error ? error.message : "Sharing settings could not be loaded. Try again.");
      })
      .finally(() => { if (!controller.signal.aborted) { setLoadedDocument(document); setRequestLoading(false); } });
    return () => controller.abort();
  }, [conversationId, document, refresh]);

  async function changeShare(action: "publish" | "revoke") {
    if (locked || mutationLock.current) return;
    mutationLock.current = true;
    setSharing(true);
    setShareError("");
    setCopied(false);
    setCopyError("");
    try {
      const response = await fetch(`/api/explanations/${conversationId}/share`, {
        method: action === "publish" ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: action === "publish" ? JSON.stringify({ showProvider }) : undefined,
      });
      const payload = await response.json() as { share?: ShareStatus; error?: { message?: string } };
      if (!response.ok || !payload.share) throw new Error(payload.error?.message ?? "The share link could not be changed. Try again.");
      setShare(payload.share);
    } catch (error) {
      setShare(null);
      setShareError(error instanceof Error ? error.message : "The request did not finish. Check your connection and try again.");
    } finally {
      mutationLock.current = false;
      setSharing(false);
    }
  }

  async function copyLink() {
    if (!share?.path) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${share.path}`);
      setCopied(true);
    } catch {
      setCopyError("Copy is unavailable. Select and copy the link below.");
    }
  }

  async function download(format: Format) {
    if (disabled || downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(format);
    setDownloaded("");
    setDownloadError("");
    try {
      const response = await fetch(`/api/explanations/${conversationId}/export?format=${format}&includeProvider=${exportProvider}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "The lesson download could not be prepared. Try again.");
      }
      const expectedType = format === "pdf" ? "application/pdf" : format === "json" ? "application/json" : "text/markdown";
      if (!response.headers.get("content-type")?.startsWith(expectedType)) throw new Error("The download arrived in an unexpected format. Try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([a-z0-9_.-]+)"/i)?.[1] ?? `clear-lesson.${format === "markdown" ? "md" : format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(`${FORMATS.find(([id]) => id === format)?.[1]} is ready. Check your browser’s downloads.`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "The download did not finish. Check your connection and try again.");
    } finally {
      downloadLock.current = false;
      setDownloading(null);
    }
  }

  return (
    <details className="surface-panel group">
      <summary className="flex list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <span><span className="block text-sm font-medium">Share &amp; export</span><span className="mt-1 block text-xs text-muted">{loading ? "Checking sharing settings" : share ? share.active ? "A public snapshot is available" : "Private to this browser" : "Sharing status unavailable"}</span></span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="grid gap-7 border-t border-line p-5 sm:p-6 xl:grid-cols-2">
        <section className="min-w-0">
          <h2 className="font-serif text-2xl">Share an explanation</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">A link publishes a frozen explanation. Follow-ups, teach-back feedback, learning records, and original uploads stay private. The explanation itself may include material from your question or files, so review the preview before sharing.</p>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={showProvider} disabled={locked} onChange={(event) => setShowProvider(event.target.checked)} className="mt-1 shrink-0 accent-accent" />
            Show the provider and model on the shared page
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted">This choice applies when you create or replace the link.</p>
          <button type="button" disabled={disabled || sharing} className="mt-4 text-sm text-accent underline underline-offset-4" onClick={(event) => { event.currentTarget.focus(); setPreviewOpen(true); dialog.current?.showModal(); }}>Preview the shared explanation</button>
          {loading ? <p className="mt-4 text-sm text-muted" role="status">Checking this lesson’s sharing settings…</p> : null}
          {share?.active && share.path ? (
            <div className="mt-5 space-y-3 rounded-xl border border-line bg-background/60 p-4">
              <p className="text-sm font-medium">Anyone with this link can read and download the snapshot.</p>
              <label className="block text-xs text-muted">
                Public share link
                <input readOnly value={`${origin}${share.path}`} onFocus={(event) => event.target.select()} className="field-control mt-2 w-full text-xs" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={locked} onClick={() => void copyLink()} className="button-secondary text-sm">{copied ? "Link copied" : "Copy link"}</button>
                <a href={share.path} target="_blank" rel="noreferrer" className="text-sm text-accent underline underline-offset-4">Open shared lesson</a>
              </div>
              {copied ? <p role="status" className="text-xs text-accent">The public link is copied.</p> : null}
              {copyError ? <p role="alert" className="text-xs text-danger">{copyError}</p> : null}
              {share.stale ? <p className="text-sm leading-relaxed text-warning">This lesson has changed since you shared it. The public link still shows the earlier snapshot.</p> : null}
              <p className="text-xs leading-relaxed text-muted">Replacing or revoking the link stops access through the old link. Copies people already downloaded remain with them.</p>
            </div>
          ) : !loading && share ? <p className="mt-5 text-sm text-muted" role="status">No public link. Your lesson stays in this browser.</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={locked || !share} onClick={() => void changeShare("publish")} className="button-primary text-sm">{sharing ? "Updating the link…" : share?.active ? "Replace link with current lesson" : "Create share link"}</button>
            {share?.active ? <button type="button" disabled={locked} onClick={() => void changeShare("revoke")} className="button-secondary text-sm">Revoke link</button> : null}
          </div>
          {shareError && !loading ? <div className="mt-4 text-sm" role="alert"><p className="text-danger">{shareError}</p><button type="button" disabled={disabled || sharing || loading} onClick={() => { setRequestLoading(true); setRefresh((value) => value + 1); }} className="mt-2 underline underline-offset-4">Reload sharing settings</button></div> : null}
        </section>
        <section className="min-w-0 border-t border-line pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <h2 className="font-serif text-2xl">Download this lesson</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Take the current explanation with you, including examples, diagram descriptions, and a quiz answer key. Downloads contain the teaching content; your conversation and learning records stay out of them.</p>
          <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={exportProvider} disabled={disabled || Boolean(downloading)} onChange={(event) => setExportProvider(event.target.checked)} className="mt-1 shrink-0 accent-accent" />Include the provider and model in downloads</label>
          <div className="mt-5 flex flex-wrap gap-3">
            {FORMATS.map(([format, label]) => <button key={format} type="button" disabled={disabled || Boolean(downloading)} onClick={() => void download(format)} className="button-secondary min-w-24 text-sm">{downloading === format ? "Preparing…" : label}</button>)}
          </div>
          {downloading ? <p role="status" className="mt-4 text-sm text-muted">Preparing the {FORMATS.find(([format]) => format === downloading)?.[1]} download…</p> : null}
          {downloaded ? <p role="status" className="mt-4 text-sm text-accent">{downloaded}</p> : null}
          {downloadError ? <p role="alert" className="mt-4 text-sm text-danger">{downloadError} Choose a format to try again.</p> : null}
          <p className="mt-5 text-xs leading-relaxed text-muted">PDFs use written diagram and interactive summaries. Characters the PDF font cannot display appear as Unicode codes; Markdown and JSON keep the original text.</p>
          <p className="mt-5 text-xs leading-relaxed text-muted">Private lessons currently belong to this browser. Clearing its site data removes access; accounts and a saved library are still to come.</p>
        </section>
      </div>
      <dialog ref={dialog} aria-labelledby={previewTitle} onClose={() => setPreviewOpen(false)} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl border border-line bg-background p-0 text-foreground backdrop:bg-black/50">
        <div className="flex items-start justify-between gap-5 border-b border-line bg-card p-5">
          <div><h2 id={previewTitle} className="font-serif text-2xl">Preview before sharing</h2><p className="mt-2 text-sm leading-relaxed text-muted">Review every view for material you want to publish.</p></div>
          <button type="button" onClick={() => dialog.current?.close()} className="button-secondary shrink-0 text-sm">Close preview</button>
        </div>
        {previewOpen ? <ReadOnlyLesson document={previewDocument} /> : null}
      </dialog>
    </details>
  );
}
