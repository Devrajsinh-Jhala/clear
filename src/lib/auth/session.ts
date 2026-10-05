import "server-only";

import { cache } from "react";

import { ClearError } from "@/src/lib/api/errors";
import { requestContext } from "@/src/lib/api/context";
import { accountFromClaims, type Account } from "@/src/lib/auth/claims";
import { createAuthClient } from "@/src/lib/auth/server";

export type { Account } from "@/src/lib/auth/claims";
const requests = new WeakMap<Request, Promise<Account | null>>();

async function readAccount(): Promise<Account | null> {
  const client = await createAuthClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims) return null;
  return accountFromClaims(data.claims);
}

const readRenderedAccount = cache(readAccount);

/** Identity comes only from verified claims, never a decoded cookie or getSession(). */
export function currentAccount(): Promise<Account | null> {
  const request = requestContext.getStore()?.request;
  if (!request) return readRenderedAccount();
  const existing = requests.get(request);
  if (existing) return existing;
  const account = readAccount();
  requests.set(request, account);
  return account;
}

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) throw new ClearError("sign_in_required", "Sign in to open your saved library.", { status: 401 });
  return account;
}
