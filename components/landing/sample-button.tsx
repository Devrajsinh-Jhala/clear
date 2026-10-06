"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Opens the built-in mutex lesson. It does not call a model. */
export function SampleButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("exampleId", "mutex");
      body.set("level", "student");
      body.set("depth", "balanced");
      const response = await fetch("/api/explanations", { method: "POST", body });
      const payload = (await response.json()) as { conversationId?: string; error?: { message?: string } };
      if (!response.ok || !payload.conversationId) {
        setError(payload.error?.message ?? "The example did not open. Try again.");
        return;
      }
      router.push(`/learn/${payload.conversationId}`);
    } catch {
      setError("The example did not open. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button type="button" disabled={pending} onClick={() => void open()} className={`button-secondary gap-2 ${className}`}>
        <Play className="size-4" aria-hidden="true" />
        {pending ? "Opening the example…" : "See an example"}
      </button>
      {error ? <span role="alert" className="text-sm text-destructive">{error}</span> : null}
    </span>
  );
}
