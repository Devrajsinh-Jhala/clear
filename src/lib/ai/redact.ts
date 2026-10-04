const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value);
}
