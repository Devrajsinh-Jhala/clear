import { isIP } from "node:net";

export type DnsLookup = (hostname: string) => Promise<string[]>;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function isBlockedIp(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isBlockedIpv4(address);
  if (ipVersion === 6) return isBlockedIpv6(address);
  return true;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIp(normalized.slice("::ffff:".length));
  }
  return false;
}

export async function assertSafeProviderUrl(
  rawUrl: string,
  options: { lookup: DnsLookup; allowLocal?: boolean },
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Provider URL is not valid.");
  }

  const allowLocal = options.allowLocal === true;
  if (url.username || url.password) {
    throw new UnsafeUrlError("Provider URL cannot include credentials.");
  }
  if (url.protocol !== "https:" && !(allowLocal && url.protocol === "http:")) {
    throw new UnsafeUrlError("Provider URL must use HTTPS.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new UnsafeUrlError("Provider URL host is not allowed.");
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname) && !(allowLocal && isLoopback(hostname))) {
      throw new UnsafeUrlError("Provider URL targets a blocked address.");
    }
    return url;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    if (!allowLocal) throw new UnsafeUrlError("Provider URL targets a blocked address.");
    return url;
  }

  const addresses = await options.lookup(hostname);
  if (addresses.length === 0) {
    throw new UnsafeUrlError("Provider URL did not resolve.");
  }
  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new UnsafeUrlError("Provider URL resolves to a blocked address.");
    }
  }
  return url;
}

function isLoopback(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address.startsWith("127.");
}
