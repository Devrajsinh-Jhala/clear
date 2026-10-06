"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ProviderLabel } from "@/components/provider-label";
import type { LibraryChange, LibraryLesson } from "@/src/lib/auth/library";

export function LibraryList({ initialLessons }: { initialLessons: LibraryLesson[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [view, setView] = useState("recent");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const lock = useRef(false);
  const providers = [...new Set(lessons.map((lesson) => lesson.provider))];
  const visible = lessons.filter((lesson) => (view === "archived" ? lesson.archived : !lesson.archived) && (view !== "favorites" || lesson.favorite) && (!provider || lesson.provider === provider) && lesson.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  async function change(lesson: LibraryLesson, update: LibraryChange | "delete") {
    if (lock.current) return;
    lock.current = true;
    setPending(lesson.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/auth/library/${lesson.id}`, { method: update === "delete" ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, body: update === "delete" ? undefined : JSON.stringify(update) });
      const payload = await response.json() as { cleanupPending?: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "The lesson could not be changed. Please try again.");
      setLessons((current) => update === "delete" ? current.filter((item) => item.id !== lesson.id) : current.map((item) => item.id !== lesson.id ? item : update.action === "rename" ? { ...item, title: update.title } : update.action === "archive" ? { ...item, archived: update.archived } : { ...item, favorite: update.favorite }));
      setEditing(null);
      setConfirmDelete(null);
      setStatus(update === "delete" ? payload.cleanupPending ? "Lesson deleted. Media cleanup will finish when your library is opened again. Its share link is unavailable." : "The lesson and its uploads were deleted. Its share link is unavailable." : "Your library is updated.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The request did not finish. Check your connection and try again."); }
    finally { lock.current = false; setPending(null); }
  }

  return <div className="space-y-5">
    <div className="surface-panel grid gap-4 p-5 sm:grid-cols-2">
      <label className="text-sm font-medium" htmlFor="library-search">Find a lesson<input id="library-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="field-control mt-2 w-full" placeholder="Search by title" /></label>
      <label className="text-sm font-medium" htmlFor="library-provider">Provider<select id="library-provider" value={provider} onChange={(event) => setProvider(event.target.value)} className="field-control mt-2 w-full"><option value="">All providers</option>{providers.map((item) => <option key={item} value={item}>{item === "gemini" || item === "clear-free" ? "CLEAR Free" : item === "sample" ? "Sample lessons" : item.replace("byok:", "Your API · ")}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2" htmlFor="library-view">Show<select id="library-view" value={view} onChange={(event) => setView(event.target.value)} className="field-control mt-2 w-full"><option value="recent">Recent lessons</option><option value="favorites">Favorites</option><option value="archived">Archived lessons</option></select></label>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error} Try the action again.</p> : null}
    {status ? <p role="status" className="text-sm text-primary">{status}</p> : null}
    {visible.length === 0 ? <section className="surface-panel p-6"><h2 className="font-heading text-2xl">{lessons.length ? "No lessons match yet" : "Start your library with a question"}</h2><p className="mt-3 text-muted-foreground">{lessons.length ? "Try another title, provider, or view." : "Lessons you create while signed in will appear here. Earlier guest lessons stay with their original browser."}</p><Link href="/ask" className="button-primary mt-5">Start a lesson</Link></section> : <ul className="space-y-4">{visible.map((lesson) => <li key={lesson.id} className="surface-panel min-w-0 p-5 sm:p-6">
      <p className="text-xs text-muted-foreground"><ProviderLabel provider={lesson.provider} model={lesson.model} /></p>
      {editing === lesson.id ? <form className="mt-3 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void change(lesson, { action: "rename", title: titleDraft.trim() }); }}><label className="sr-only" htmlFor={`title-${lesson.id}`}>Lesson title</label><input id={`title-${lesson.id}`} required maxLength={160} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="field-control min-w-0 flex-1" /><button type="submit" disabled={Boolean(pending)} className="button-primary text-sm">Save title</button><button type="button" disabled={Boolean(pending)} onClick={() => setEditing(null)} className="button-secondary text-sm">Cancel</button></form> : <h2 className="mt-3 break-words font-heading text-2xl"><Link href={`/learn/${lesson.id}`} className="hover:text-primary">{lesson.title}</Link></h2>}
      <p className="mt-3 text-xs text-muted-foreground">Last updated <time dateTime={lesson.updatedAt}>{new Date(lesson.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>{lesson.favorite ? " · Favorite" : ""}</p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm"><button type="button" disabled={Boolean(pending)} onClick={() => void change(lesson, { action: "favorite", favorite: !lesson.favorite })} className="text-primary underline underline-offset-4">{lesson.favorite ? "Remove favorite" : "Favorite"}</button><button type="button" disabled={Boolean(pending)} onClick={() => { setEditing(lesson.id); setTitleDraft(lesson.title); setConfirmDelete(null); }} className="text-muted-foreground underline underline-offset-4">Rename</button><button type="button" disabled={Boolean(pending)} onClick={() => void change(lesson, { action: "archive", archived: !lesson.archived })} className="text-muted-foreground underline underline-offset-4">{lesson.archived ? "Restore" : "Archive"}</button><button type="button" disabled={Boolean(pending)} onClick={() => { setConfirmDelete(lesson.id); setEditing(null); }} className="text-destructive underline underline-offset-4">Delete</button></div>
      {confirmDelete === lesson.id ? <div className="mt-4 rounded-xl border border-destructive/30 p-4"><p className="text-sm">Delete “{lesson.title}”, its conversation, and its uploads? Its share link will stop working. Downloaded copies cannot be removed.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={Boolean(pending)} onClick={() => void change(lesson, "delete")} className="button-secondary text-sm text-destructive">{pending === lesson.id ? "Deleting…" : "Delete this lesson"}</button><button type="button" disabled={Boolean(pending)} onClick={() => setConfirmDelete(null)} className="button-secondary text-sm">Keep lesson</button></div></div> : null}
    </li>)}</ul>}
    <p className="text-xs leading-relaxed text-muted-foreground">Shows your latest 100 lessons, including archived ones. Guest lessons, keys, and settings are not imported automatically.</p>
  </div>;
}
