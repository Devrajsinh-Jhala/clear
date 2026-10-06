"use client";

import { useEffect, useState } from "react";

import type { LearningProfile } from "@/src/lib/learning/memory";

export function LearningMemoryControl() {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/learning")
      .then((response) => response.json())
      .then((payload: { profile?: LearningProfile }) => setProfile(payload.profile ?? null))
      .catch(() => setError("Learning memory could not be loaded."));
  }, []);

  async function update(enabled: boolean) {
    setPending(true);
    setError("");
    const response = await fetch("/api/learning", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const payload = (await response.json()) as { profile?: LearningProfile; error?: { message?: string } };
    setPending(false);
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "That change did not save.");
      return;
    }
    setProfile(payload.profile);
  }

  async function erase() {
    setPending(true);
    setError("");
    const response = await fetch("/api/learning", { method: "DELETE" });
    const payload = (await response.json()) as { profile?: LearningProfile; error?: { message?: string } };
    setPending(false);
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "The records were not deleted.");
      return;
    }
    setProfile(payload.profile);
  }

  return (
    <section className="surface-panel p-5 sm:p-7">
      <h2 className="font-heading text-2xl">Learning memory</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Off until you turn it on. CLEAR stores concept names and review notes for this browser on this server. It does not infer personal attributes.
      </p>
      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={profile?.enabled ?? false}
          disabled={pending || !profile}
          onChange={(event) => void update(event.target.checked)}
        />
        Remember what I am learning
      </label>
      <button type="button" className="button-secondary mt-4 text-sm" disabled={pending} onClick={() => void erase()}>
        Delete all learning records
      </button>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
