import { PageShell } from "@/components/page-shell";
import { AccountForm } from "@/src/components/account-form";
import { authenticationAvailable } from "@/src/lib/auth/config";
import { currentAccount } from "@/src/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const account = await currentAccount();
  return <PageShell title="Your CLEAR account" lede="A private library that follows you."><AccountForm configured={authenticationAvailable()} signedIn={Boolean(account)} accountEmail={account?.email ?? null} /></PageShell>;
}
