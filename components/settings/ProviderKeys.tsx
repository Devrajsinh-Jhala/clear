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
    <section className="space-y-4">
      <ul className="divide-y divide-line border-y border-line">
        {connected.length === 0 ? <li className="py-3 text-sm text-muted">No saved keys on this browser yet.</li> : null}
        {connected.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="block">Your API · {item.label}</span>
              <span className="text-sm text-muted">
                {item.maskedSuffix} · {item.model}
                {item.baseHost ? ` · ${item.baseHost}` : ""}
              </span>
            </span>
            <span className="flex gap-3 text-sm">
              <button type="button" disabled={pending} onClick={() => act(item.id, "test")} className="underline">
                Test
              </button>
              <button type="button" disabled={pending} onClick={() => act(item.id, "remove")} className="underline">
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <label className="text-sm text-muted">
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
            className="ml-2 bg-transparent text-foreground"
          >
            {BYOK_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          API key
          <input
            aria-label="Provider API key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="ml-2 w-full max-w-md border-b border-line bg-transparent text-foreground"
          />
        </label>
        <label className="text-sm text-muted">
          Model
          <input
            aria-label="Model id"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="ml-2 border-b border-line bg-transparent text-foreground"
          />
        </label>
        {selected.needsBaseUrl ? (
          <label className="text-sm text-muted">
            Base URL
            <input
              aria-label="Provider base URL"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com/v1"
              className="ml-2 w-full max-w-md border-b border-line bg-transparent text-foreground"
            />
          </label>
        ) : null}
        <button type="submit" disabled={pending} className="w-fit underline">
          {pending ? "Checking…" : "Save and test"}
        </button>
      </form>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
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
