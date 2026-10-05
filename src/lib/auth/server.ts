import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { ClearError } from "@/src/lib/api/errors";
import { authConfiguration } from "@/src/lib/auth/config";

export async function createAuthClient(options: { writable?: boolean } = {}) {
  const configuration = authConfiguration();
  if (!configuration) return null;
  const cookieStore = await cookies();
  return createServerClient(configuration.url, configuration.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options: settings } of values) {
            cookieStore.set(name, value, { ...settings, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
          }
        } catch {
          // Server-rendered pages read cookies; the Next proxy refreshes them.
          if (options.writable) throw new ClearError("auth_unavailable", "Your sign-in could not be saved. Please try again.", { status: 503, retryable: true });
        }
      },
    },
  });
}

export async function requireAuthClient() {
  const client = await createAuthClient({ writable: true });
  if (!client) throw new ClearError("auth_unavailable", "Sign-in is not available on this server yet. You can still start a guest lesson.", { status: 503 });
  return client;
}
