"use client";

import { Brain, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { ConceptMemory, MisconceptionMemory } from "@/src/lib/learning/memory";

const GROUPS = [
  ["understood", "Understood"],
  ["practicing", "Practicing"],
  ["introduced", "Introduced"],
  ["needs_review", "Needs review"],
  ["new", "New"],
] as const;

export function ProgressBoard({
  enabled,
  concepts,
  misconceptions,
}: {
  enabled: boolean;
  concepts: ConceptMemory[];
  misconceptions: MisconceptionMemory[];
}) {
  const [items, setItems] = useState(concepts);
  const [notes, setNotes] = useState(misconceptions);
  const [error, setError] = useState("");

  if (!enabled) {
    return (
      <section className="surface-panel flex flex-col items-start gap-4 p-6 sm:p-7">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Brain className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-2xl">Learning memory is off</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Turn it on in Settings if you want CLEAR to remember concepts from teach-it-back. Mastery here is a study note, not a certification.
          </p>
        </div>
        <Link href="/settings" className="button-primary">Open settings</Link>
      </section>
    );
  }

  async function forget(key: string) {
    const response = await fetch(`/api/learning/${encodeURIComponent(key)}`, { method: "DELETE" });
    const payload = (await response.json()) as {
      profile?: { concepts: ConceptMemory[]; misconceptions: MisconceptionMemory[] };
      error?: { message?: string };
    };
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "That concept was not deleted.");
      return;
    }
    setItems(payload.profile.concepts);
    setNotes(payload.profile.misconceptions);
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">These states are a heuristic from your teach-back reviews. They are not a scientific score.</p>
      {GROUPS.map(([state, label]) => {
        const group = items.filter((item) => item.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state}>
            <h2 className="font-heading text-2xl">{label}</h2>
            <ul className="mt-3 space-y-2">
              {group.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
                  <span>{item.name}</span>
                  <button type="button" aria-label={`Delete ${item.name}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => void forget(item.key)}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-muted-foreground">Nothing is stored yet. Teach a lesson back after memory is on.</p> : null}
      {notes.filter((note) => note.status === "open").length > 0 ? (
        <section>
          <h2 className="font-heading text-2xl">Misconceptions</h2>
          <ul className="mt-3 space-y-3">
            {notes
              .filter((note) => note.status === "open")
              .map((note) => (
                <li key={`${note.conceptKey}-${note.statement}`} className="rounded-xl border border-border bg-card p-4">
                  <p>{note.statement}</p>
                  <p className="mt-2 text-muted-foreground">{note.correction}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
