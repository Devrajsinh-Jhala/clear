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
  if (a === 192 && ((b === 0 && (parts[2] === 0 || parts[2] === 2)) || (b === 88 && parts[2] === 99))) return true;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  // URL normalization removes equivalent expanded/IPv4-embedded spellings.
  let normalized: string;
  try { normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase(); }
  catch { return true; } // Scoped/zone identifiers cannot be a public provider.
  const [first, second = "0"] = normalized.split(":");
  const prefix = parseInt(first, 16);
  // Only globally routed unicast can be a production provider. This rejects the
  // entire link-local/multicast/ULA/loopback/mapped/NAT64 address spaces.
  if (!Number.isFinite(prefix) || prefix < 0x2000 || prefix > 0x3fff) return true;
  if (prefix === 0x2002 || prefix === 0x3fff) return true; // 6to4 and documentation.
  if (prefix === 0x2001 && (parseInt(second || "0", 16) < 0x0200 || second === "db8")) return true;
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
  let canonical: string;
  try { canonical = isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address; }
  catch { return false; }
  return canonical === "::1" || canonical.startsWith("127.");
}
