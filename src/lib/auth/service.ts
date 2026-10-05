import "server-only";

import { ClearError } from "@/src/lib/api/errors";
import { accountFromClaims } from "@/src/lib/auth/claims";
import { requireAuthClient } from "@/src/lib/auth/server";

export type PasswordSignUpResult =
  | { signedIn: true; needsConfirmation: false }
  | { signedIn: false; needsConfirmation: true };

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = await requireAuthClient();
  let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>;
  try { result = await client.auth.signInWithPassword({ email, password }); }
  catch { throw authFailure("Sign-in could not finish. Please try again shortly."); }
  if (result.error) throw passwordFailure("sign-in", result.error.status);
  if (!result.data.session || !result.data.user) throw passwordFailure("sign-in", 401);
  await verifyPasswordSession(client, result.data.user.id);
}

export async function signUpWithPassword(email: string, password: string): Promise<PasswordSignUpResult> {
  const client = await requireAuthClient();
  let result: Awaited<ReturnType<typeof client.auth.signUp>>;
  try { result = await client.auth.signUp({ email, password }); }
  catch { throw authFailure("Your account could not be created right now. Please try again shortly."); }
  if (result.error) throw passwordFailure("sign-up", result.error.status);
  // Supabase returns no session while email confirmation is required. Do not
  // invent one or reveal whether an existing email received an obfuscated user.
  if (!result.data.session) return { signedIn: false, needsConfirmation: true };
  if (!result.data.user) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw authFailure("Your sign-in could not be verified. Please try signing in again.");
  }
  await verifyPasswordSession(client, result.data.user.id);
  return { signedIn: true, needsConfirmation: false };
}

async function verifyPasswordSession(client: Awaited<ReturnType<typeof requireAuthClient>>, userId: string): Promise<void> {
  let valid = false;
  try {
    const { data, error } = await client.auth.getClaims();
    valid = !error && !!data?.claims && accountFromClaims(data.claims)?.id === userId;
  } catch { /* Upstream errors can contain credentials or private account details. */ }
  if (!valid) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw authFailure("Your sign-in could not be verified. Please try signing in again.");
  }
}

function passwordFailure(operation: "sign-in" | "sign-up", status?: number): ClearError {
  if (status === 429) return authFailure("Too many sign-in attempts. Please wait a little and try again.", 429);
  if (!status || status >= 500) return authFailure("The sign-in service is temporarily unavailable. Please try again shortly.");
  return new ClearError("auth_failed", operation === "sign-in"
    ? "The email or password was not accepted. Check both and try again."
    : "An account could not be created. Check your details or try signing in.", { status: operation === "sign-in" ? 401 : 400 });
}

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
