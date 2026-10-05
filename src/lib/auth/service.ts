import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { accountFromClaims } from "@/src/lib/auth/claims";
import { requireAuthClient } from "@/src/lib/auth/server";

export async function requestEmailCode(email: string): Promise<void> {
  const client = await requireAuthClient();
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw authFailure("A sign-in code could not be sent. Please wait a little and try again.", error.status);
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const client = await requireAuthClient();
  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.session || !data.user) throw authFailure("That code was not accepted. Check the email and code, or request a new one.", error?.status, false);
  // The OTP response is server-verified; verify its token before reporting success.
  const { data: verified, error: claimError } = await client.auth.getClaims();
  if (claimError || !verified?.claims || accountFromClaims(verified.claims)?.id !== data.user.id) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw authFailure("Your sign-in could not be verified. Please request a new code.");
  }
}

export async function signOutAccount(): Promise<void> {
  const client = await requireAuthClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw authFailure("Sign-out did not finish. Please try again.", error.status);
}

function authFailure(message: string, status?: number, retryable = true) {
  return new ClearError("auth_failed", message, { status: status === 429 ? 429 : retryable ? 503 : 400, retryable });
}
