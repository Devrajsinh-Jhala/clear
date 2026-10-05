"use client";

import { useCallback, useEffect, useState } from "react";

import type { ApprovedTarget, RouteProviderId, RoutingPreferences, RoutingTaskId } from "@/src/lib/routing/choose";
import { ROUTING_TASKS } from "@/src/lib/routing/choose";

type Payload = {
  preferences?: RoutingPreferences;
  available?: ApprovedTarget[];
  error?: { message?: string };
};

export function RoutingControl() {
  const [preferences, setPreferences] = useState<RoutingPreferences | null>(null);
  const [available, setAvailable] = useState<ApprovedTarget[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => fetch("/api/routing")
    .then(async (response) => {
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.preferences) {
        setMessage(payload.error?.message ?? "Routing settings could not be loaded.");
        return;
      }
      setPreferences(payload.preferences);
      setAvailable(payload.available ?? []);
    }).catch(() => {
      setMessage("Routing settings could not be loaded. Please try again.");
    }).finally(() => {
      setLoading(false);
    }), []);
  useEffect(() => { void load(); }, [load]);

  if (!preferences) return (
    <section className="space-y-3" aria-busy={loading}>
      <h2 className="font-serif text-2xl">Model routing</h2>
      {loading ? <p className="text-sm text-muted">Loading routing…</p> : <>
        <p role="alert" className="text-sm text-foreground">{message}</p>
        <button type="button" onClick={() => { setLoading(true); setMessage(""); void load(); }} className="underline">Try again</button>
      </>}
    </section>
  );

  function setTask(task: RoutingTaskId, provider: string) {
    setPreferences((current) => {
      if (!current) return current;
      const tasks = { ...current.tasks };
      if (!provider) {
        delete tasks[task];
      } else {
        const match = available.find((item) => item.provider === provider);
        tasks[task] = { provider: provider as RouteProviderId, model: match?.model ?? "" };
      }
      return { ...current, tasks };
    });
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/routing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.preferences) {
        setMessage(payload.error?.message ?? "Routing did not save.");
        return;
      }
      setPreferences(payload.preferences);
      setMessage("Routing saved for this browser.");
    } catch {
      setMessage("Routing did not save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Model routing</h2>
      <p className="text-sm text-muted">
        Auto only chooses a provider you have already approved. If fallback is off, a failed provider stops the lesson.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={preferences.auto}
          onChange={(event) => setPreferences({ ...preferences, auto: event.target.checked })}
        />
        Auto routing
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={preferences.fallbackAllowed}
          onChange={(event) => setPreferences({ ...preferences, fallbackAllowed: event.target.checked })}
        />
        If the chosen provider fails, use CLEAR Free and say so
      </label>
      <label className="block text-sm text-muted">
        Default
        <select
          aria-label="Default provider"
          value={preferences.defaultTarget.provider}
          onChange={(event) => {
            const provider = event.target.value as RouteProviderId;
            const match = available.find((item) => item.provider === provider);
            setPreferences({
              ...preferences,
              defaultTarget: { provider, model: match?.model ?? preferences.defaultTarget.model },
            });
          }}
          className="ml-2 bg-transparent text-foreground"
        >
          {available.map((item) => (
            <option key={item.provider} value={item.provider}>
              {item.label} · {item.model}
            </option>
          ))}
        </select>
      </label>
      <ul className="divide-y divide-line border-y border-line">
        {ROUTING_TASKS.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>{task.label}</span>
            <select
              aria-label={`${task.label} provider`}
              value={preferences.tasks[task.id]?.provider ?? ""}
              onChange={(event) => setTask(task.id, event.target.value)}
              className="bg-transparent text-foreground"
            >
              <option value="">Use default</option>
              {available.map((item) => (
                <option key={item.provider} value={item.provider}>
                  {item.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <button type="button" disabled={pending} onClick={() => void save()} className="underline">
        {pending ? "Saving…" : "Save routing"}
      </button>
      {message ? <p role="status" className="text-sm text-foreground">{message}</p> : null}
    </section>
  );
}
