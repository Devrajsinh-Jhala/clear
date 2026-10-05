"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function AccountForm({ configured, accountEmail, signedIn }: { configured: boolean; accountEmail: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);

  async function act(action: "code" | "verify" | "logout") {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "logout" ? undefined : JSON.stringify(action === "code" ? { email: email.trim() } : { email: email.trim(), token: token.trim() }),
      });
      const payload = await response.json() as { sent?: boolean; signedIn?: boolean; signedOut?: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Sign-in did not finish. Please try again.");
      if (action === "code") { setCodeSent(true); setToken(""); }
      else if (action === "verify") { router.push("/library"); router.refresh(); }
      else { router.refresh(); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request did not finish. Check your connection and try again.");
    } finally { locked.current = false; setPending(false); }
  }

  if (!configured) return <section className="surface-panel p-6"><h2 className="font-serif text-2xl">Guest lessons are ready</h2><p className="mt-3 text-muted">Sign-in is not available on this server yet. You can still ask a question and return to your private lesson in this browser.</p><Link href="/" className="button-primary mt-5">Start a lesson</Link></section>;
  if (signedIn) return <section className="surface-panel p-6"><h2 className="font-serif text-2xl">You’re signed in</h2>{accountEmail ? <p className="mt-3 break-all text-muted">{accountEmail}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><Link href="/library" className="button-primary">Open your library</Link><button type="button" className="button-secondary" disabled={pending} onClick={() => void act("logout")}>{pending ? "Signing out…" : "Sign out"}</button></div>{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}</section>;

  return <form className="surface-panel p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); void act(codeSent ? "verify" : "code"); }}>
    <h2 className="font-serif text-2xl">Keep your lessons across devices</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted">Use a one-time email code. No password to remember.</p>
    <label htmlFor="account-email" className="mt-5 block text-sm font-medium">Email address</label>
    <input id="account-email" type="email" required maxLength={254} autoComplete="email" value={email} disabled={pending || codeSent} onChange={(event) => setEmail(event.target.value)} className="field-control mt-2 w-full" />
    {codeSent ? <><p role="status" className="mt-4 text-sm text-muted">If this email can receive a code, it has been sent. Check your inbox and spam folder.</p><label htmlFor="account-token" className="mt-5 block text-sm font-medium">Email code</label><input id="account-token" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,8}" minLength={6} maxLength={8} value={token} disabled={pending} onChange={(event) => setToken(event.target.value)} className="field-control mt-2 w-full font-mono tracking-[0.2em]" /></> : null}
    <button type="submit" disabled={pending} className="button-primary mt-5 w-full">{pending ? codeSent ? "Checking your code…" : "Sending your code…" : codeSent ? "Sign in" : "Send email code"}</button>
    {codeSent ? <div className="mt-4 flex flex-wrap gap-4 text-sm"><button type="button" disabled={pending} onClick={() => void act("code")} className="text-accent underline underline-offset-4">Send a new code</button><button type="button" disabled={pending} onClick={() => { setCodeSent(false); setToken(""); setError(""); }} className="text-muted underline underline-offset-4">Use another email</button></div> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-danger">{error} Your email is still here.</p> : null}
    <p className="mt-5 border-t border-line pt-5 text-xs leading-relaxed text-muted">New signed-in lessons belong to your account. Earlier guest lessons, keys, and settings stay with their original browser identity and are not moved automatically.</p>
  </form>;
}
