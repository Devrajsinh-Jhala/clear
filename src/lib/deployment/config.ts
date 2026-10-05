export type ReadinessCheck = { name: string; ready: boolean };

export function deploymentChecks(env: Record<string, string | undefined> = process.env): ReadinessCheck[] {
  const secureUrl = (value?: string) => { try { return new URL(value || "").protocol === "https:"; } catch { return false; } };
  const key = env.APP_ENCRYPTION_KEY || "";
  const validDsn = (value?: string) => { try { const url = new URL(value || ""); return url.protocol === "https:" && !!url.username && !url.password && !url.search && !url.hash && /\/\d+$/.test(url.pathname); } catch { return false; } };
  return [
    { name: "Public HTTPS URL", ready: secureUrl(env.NEXT_PUBLIC_APP_URL) },
    { name: "Supabase URL", ready: secureUrl(env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: "Supabase public auth key", ready: !!(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    { name: "Supabase server key", ready: !!(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY) },
    { name: "Encryption key", ready: /^[A-Za-z0-9+/]{43}=$/.test(key) && Buffer.from(key, "base64").length === 32 },
    { name: "CLEAR Free live provider", ready: !!env.GEMINI_API_KEY && env.CLEAR_PROVIDER !== "mock" },
    { name: "Trusted Vercel client IP", ready: ["x-forwarded-for", "x-vercel-forwarded-for"].includes(env.CLEAR_TRUSTED_IP_HEADER || "") },
    { name: "Server monitoring", ready: validDsn(env.SENTRY_DSN) },
    { name: "Browser monitoring", ready: validDsn(env.NEXT_PUBLIC_SENTRY_DSN) },
  ];
}
