"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

type AccessMode = "sign-in" | "sign-up";
type AccessResponse = { signedIn?: boolean; needsConfirmation?: boolean; signedOut?: boolean; error?: { message?: string } };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AccountForm({ configured, accountEmail, signedIn }: { configured: boolean; accountEmail: string | null; signedIn: boolean }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AccessMode>("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locked = useRef(false);

  function changeMode(nextMode: AccessMode) {
    if (locked.current) return;
    setMode(nextMode);
    setPassword("");
    setError("");
    setMessage("");
  }

  async function act(action: AccessMode | "logout") {
    if (!hydrated || locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "logout" ? undefined : JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json() as AccessResponse;
      if (!response.ok) throw new Error(payload.error?.message ?? "Sign-in did not finish. Please try again.");
      if (action === "logout" && payload.signedOut) {
        setPassword("");
        router.refresh();
      } else if (payload.signedIn) {
        setPassword("");
        router.replace("/library");
        router.refresh();
      } else if (action === "sign-up" && payload.needsConfirmation) {
        setPassword("");
        setMode("sign-in");
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        throw new Error("Sign-in did not finish. Please try again.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request did not finish. Check your connection and try again.");
    } finally { locked.current = false; setPending(false); }
  }

  if (!configured) return <section className="surface-panel p-6"><h2 className="font-heading text-2xl">Guest lessons are ready</h2><p className="mt-3 text-muted-foreground">Sign-in is not available yet. You can still ask a question and return to your private lesson in this browser.</p><Link href="/ask" className="button-primary mt-5">Start a lesson</Link></section>;
  if (signedIn) return <section className="surface-panel p-6"><h2 className="font-heading text-2xl">You’re signed in</h2>{accountEmail ? <p className="mt-3 break-all text-muted-foreground">{accountEmail}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><Link href="/library" className="button-primary">Open your library</Link><button type="button" className="button-secondary" disabled={pending || !hydrated} onClick={() => void act("logout")}>{pending ? "Signing out…" : "Sign out"}</button></div>{error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}</section>;

  return <form action={`/api/auth/${mode}`} method="post" aria-busy={pending} className="surface-panel p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); void act(mode); }}>
    <div className="mb-6 flex flex-wrap gap-3" role="group" aria-label="Account access">
      <button type="button" aria-pressed={mode === "sign-in"} disabled={pending || !hydrated} onClick={() => changeMode("sign-in")} className={mode === "sign-in" ? "button-primary text-sm" : "button-secondary text-sm"}>Sign in</button>
      <button type="button" aria-pressed={mode === "sign-up"} disabled={pending || !hydrated} onClick={() => changeMode("sign-up")} className={mode === "sign-up" ? "button-primary text-sm" : "button-secondary text-sm"}>Create account</button>
    </div>
    <h2 className="font-heading text-2xl">{mode === "sign-up" ? "Create your CLEAR account" : "Welcome back to CLEAR"}</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Keep your lessons across devices with your email and password.</p>
    {message ? <p role="status" className="mt-4 text-sm text-foreground">{message}</p> : null}
    <label htmlFor="account-email" className="mt-5 block text-sm font-medium">Email address</label>
    <input id="account-email" name="email" type="email" required maxLength={254} autoComplete="username" value={email} disabled={pending || !hydrated} onChange={(event) => setEmail(event.target.value)} className="field-control mt-2 w-full" />
    <label htmlFor="account-password" className="mt-5 block text-sm font-medium">Password</label>
    <input id="account-password" name="password" type="password" required minLength={mode === "sign-up" ? 8 : 1} maxLength={128} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} aria-describedby={mode === "sign-up" ? "account-password-hint" : undefined} value={password} disabled={pending || !hydrated} onChange={(event) => setPassword(event.target.value)} className="field-control mt-2 w-full" />
    {mode === "sign-up" ? <p id="account-password-hint" className="mt-2 text-xs text-muted-foreground">Use at least 8 characters.</p> : null}
    <button type="submit" disabled={pending || !hydrated} className="button-primary mt-5 w-full">{pending ? mode === "sign-up" ? "Creating your account…" : "Signing in…" : mode === "sign-up" ? "Create account" : "Sign in"}</button>
    {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
    <p className="mt-5 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">CLEAR cannot reset a forgotten password yet, so keep yours somewhere safe. New signed-in lessons belong to your account. Earlier guest lessons, keys, and settings stay with their original browser identity and are not moved automatically.</p>
  </form>;
}
