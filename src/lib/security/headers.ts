function integrationOrigin(value?: string): string[] {
  if (!value) return [];
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? [url.origin] : [];
  } catch { return []; }
}

export function securityHeaders(nonce: string): Record<string, string> {
  const development = process.env.NODE_ENV === "development";
  const integrations = [...integrationOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN), ...integrationOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)];
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
      // Trusted diagram layouts, theme changes and widget sizing use inline CSS.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:", "font-src 'self'", "media-src 'self' blob:",
      `connect-src 'self' ${integrations.join(" ")}${development ? " ws: wss:" : ""}`.trim(),
      "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
      ...(process.env.VERCEL === "1" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
    "Cache-Control": "private, no-store, max-age=0",
    ...(process.env.VERCEL === "1" ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  };
}
