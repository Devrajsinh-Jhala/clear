"use client";

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
      <p>
        Learning memory is off. Turn it on in Settings if you want CLEAR to remember concepts from teach-it-back. Mastery here is a study note, not a certification.
      </p>
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
      <p className="text-sm text-muted">These states are a heuristic from your teach-back reviews. They are not a scientific score.</p>
      {GROUPS.map(([state, label]) => {
        const group = items.filter((item) => item.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state}>
            <h2 className="font-serif text-2xl">{label}</h2>
            <ul className="mt-3 space-y-2">
              {group.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 border border-line px-3 py-2">
                  <span>{item.name}</span>
                  <button type="button" className="text-sm text-muted underline" onClick={() => void forget(item.key)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {items.length === 0 ? <p>Nothing is stored yet. Teach a lesson back after memory is on.</p> : null}
      {notes.filter((note) => note.status === "open").length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">Misconceptions</h2>
          <ul className="mt-3 space-y-3">
            {notes
              .filter((note) => note.status === "open")
              .map((note) => (
                <li key={`${note.conceptKey}-${note.statement}`} className="border border-line p-3">
                  <p>{note.statement}</p>
                  <p className="mt-2 text-muted">{note.correction}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
