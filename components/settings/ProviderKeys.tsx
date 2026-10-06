"use client";

import { useEffect, useState } from "react";

import { BYOK_PROVIDERS, type ByokProviderId } from "@/src/lib/ai/byok";

type Connected = {
  id: ByokProviderId;
  label: string;
  maskedSuffix: string;
  model: string;
  baseHost?: string;
};

export function ProviderKeys() {
  const [connected, setConnected] = useState<Connected[]>([]);
  const [provider, setProvider] = useState<ByokProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const selected = BYOK_PROVIDERS.find((item) => item.id === provider) ?? BYOK_PROVIDERS[1];

  useEffect(() => {
    void refresh(setConnected, setMessage);
  }, []);

  async function connect() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          model,
          baseUrl: selected.needsBaseUrl ? baseUrl : undefined,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "CLEAR could not save that key.");
        return;
      }
      setApiKey("");
      setMessage("Saved. CLEAR tested the key and only keeps the last four characters visible.");
      await refresh(setConnected, setMessage);
    } finally {
      setPending(false);
    }
  }

  async function act(id: ByokProviderId, action: "test" | "remove") {
    setPending(true);
    setMessage("");
    try {
      const response =
        action === "test"
          ? await fetch("/api/providers/test", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ provider: id }),
            })
          : await fetch(`/api/providers?provider=${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(payload.error?.message ?? "That provider request failed.");
        return;
      }
      setMessage(action === "test" ? "That key answered a test request." : "Removed from this browser.");
      await refresh(setConnected, setMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-panel space-y-5 p-5 sm:p-7">
      <h2 className="font-heading text-2xl">Your provider keys</h2>
      <ul className="divide-y divide-border border-y border-border">
        {connected.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No saved keys on this browser yet.</li> : null}
        {connected.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="block">Your API · {item.label}</span>
              <span className="text-sm text-muted-foreground">
                {item.maskedSuffix} · {item.model}
                {item.baseHost ? ` · ${item.baseHost}` : ""}
              </span>
            </span>
            <span className="flex gap-3 text-sm">
              <button type="button" disabled={pending} onClick={() => act(item.id, "test")} className="button-secondary !min-h-8 !px-3 !py-1 text-xs">
                Test
              </button>
              <button type="button" disabled={pending} onClick={() => act(item.id, "remove")} className="button-secondary !min-h-8 !px-3 !py-1 text-xs">
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <label className="block text-sm text-muted-foreground">
          Provider
          <select
            aria-label="Provider to connect"
            value={provider}
            onChange={(event) => {
              const next = event.target.value as ByokProviderId;
              setProvider(next);
              const match = BYOK_PROVIDERS.find((item) => item.id === next);
              if (match) setModel(match.modelPlaceholder);
            }}
            className="field-control mt-2 block w-full"
          >
            {BYOK_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted-foreground">
          API key
          <input
            aria-label="Provider API key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="field-control mt-2 block w-full"
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Model
          <input
            aria-label="Model id"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="field-control mt-2 block w-full"
          />
        </label>
        {selected.needsBaseUrl ? (
          <label className="block text-sm text-muted-foreground">
            Base URL
            <input
              aria-label="Provider base URL"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com/v1"
              className="field-control mt-2 block w-full"
            />
          </label>
        ) : null}
        <button type="submit" disabled={pending} className="button-primary w-fit sm:col-span-2">
          {pending ? "Checking…" : "Save and test"}
        </button>
      </form>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}

async function refresh(
  setConnected: (value: Connected[]) => void,
  setMessage: (value: string) => void,
) {
  const response = await fetch("/api/providers");
  const payload = (await response.json()) as { connected?: Connected[]; error?: { message?: string } };
  if (!response.ok) {
    setMessage(payload.error?.message ?? "CLEAR could not list saved keys.");
    return;
  }
  setConnected(payload.connected ?? []);
}
