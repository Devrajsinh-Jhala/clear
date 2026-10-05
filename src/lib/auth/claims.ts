import { isUuid } from "@/src/lib/explanation/normalize";

export type Account = { id: string; email: string | null };

/** The caller must first verify the token with Supabase getClaims(). */
export function accountFromClaims(claims: Record<string, unknown>): Account | null {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (typeof claims.sub !== "string" || !isUuid(claims.sub) || claims.role !== "authenticated" || !audience.includes("authenticated") || claims.is_anonymous === true) return null;
  if (typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
