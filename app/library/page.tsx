import { PageShell } from "@/components/page-shell";
import Link from "next/link";
import { LibraryList } from "@/src/components/library-list";
import { authenticationAvailable } from "@/src/lib/auth/config";
import { listAccountLessons } from "@/src/lib/auth/library";
import { currentAccount } from "@/src/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const account = await currentAccount();
  if (account) {
    const lessons = await listAccountLessons();
    return <PageShell title="Your library" lede="Return to an idea, find a favorite, or start something new."><LibraryList initialLessons={lessons} /></PageShell>;
  }
  return (
    <PageShell title="Your library" lede="Keep your understanding close.">
      <section className="surface-panel p-6"><h2 className="font-heading text-2xl">{authenticationAvailable() ? "Sign in to find your saved lessons" : "Keep learning as a guest"}</h2><p className="mt-3 text-muted-foreground">{authenticationAvailable() ? "New lessons you create while signed in follow your account across devices." : "Accounts are not available on this server yet. Your guest lesson stays at its address in the browser that created it."}</p><p className="mt-3 text-sm text-muted-foreground">Earlier guest lessons, keys, and settings stay with their original browser and are not moved automatically.</p><div className="mt-5 flex flex-wrap gap-3">{authenticationAvailable() ? <Link href="/auth" className="button-primary">Sign in</Link> : null}<Link href="/ask" className="button-secondary">Start a lesson</Link></div></section>
    </PageShell>
  );
}
