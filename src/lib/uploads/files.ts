const ALLOWED = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
} as const;

export type AllowedMime = keyof typeof ALLOWED;

export function uploadLimitBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 10);
  const configured = (Number.isFinite(mb) && mb > 0 ? Math.min(mb, 20) : 10) * 1024 * 1024;
  return process.env.VERCEL ? Math.min(configured, 3 * 1024 * 1024) : configured;
}

export function totalUploadLimitBytes(): number {
  const configured = Number(process.env.MAX_TOTAL_UPLOAD_MB || 30);
  const total = (Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60) : 30) * 1024 * 1024;
  return Math.min(total, process.env.VERCEL ? 3 * 1024 * 1024 : 3 * uploadLimitBytes());
}

export function maxPdfPages(): number {
  const pages = Number(process.env.MAX_PDF_PAGES || 40);
  return Number.isSafeInteger(pages) && pages > 0 ? Math.min(pages, 100) : 40;
}

export function assertUploadSignature(bytes: Uint8Array, mimeType: AllowedMime): void {
  const begins = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  const valid = mimeType === "image/png" ? begins([137, 80, 78, 71, 13, 10, 26, 10])
    : mimeType === "image/jpeg" ? bytes.length >= 4 && begins([255, 216, 255])
      : mimeType === "image/gif" ? bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))
        : mimeType === "image/webp" ? bytes.length >= 16 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP"
          && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) <= bytes.length - 8
          : bytes.length >= 8 && /^%PDF-\d\.\d/.test(ascii(0, 8));
  if (!valid) throw new Error("The file contents do not match its type. Use a valid image or PDF.");
}

export function extensionForMime(mimeType: string): string | null {
  return ALLOWED[mimeType as AllowedMime] ?? null;
}

export function assertUpload(input: { mimeType: string; sizeBytes: number; filename: string }): AllowedMime {
  const extension = extensionForMime(input.mimeType);
  if (!extension) {
    throw new Error("Use a PNG, JPEG, WebP, GIF, or PDF.");
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > uploadLimitBytes()) {
    throw new Error("That file is empty or larger than the upload limit.");
  }
  const lower = input.filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot !== -1 && lower.slice(dot) !== extension && !(extension === ".jpg" && lower.endsWith(".jpeg"))) {
    throw new Error("The file extension does not match its type.");
  }
  return input.mimeType as AllowedMime;
}

export function parsePageSelection(value: string, pageCount: number): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error("That PDF has no readable pages.");
  if (value.length > 1000) throw new Error("Choose a shorter page range.");
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const range = piece.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > pageCount) {
        throw new Error("That page range is outside the document.");
      }
      if (end - start + 1 > maxPdfPages()) throw new Error("That selection has too many pages.");
      for (let page = start; page <= end; page += 1) pages.add(page);
      if (pages.size > maxPdfPages()) throw new Error("That selection has too many pages.");
      continue;
    }
    if (!/^\d+$/.test(piece)) throw new Error("Use page numbers like 1-3, 5.");
    const page = Number(piece);
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) throw new Error("That page is outside the document.");
    pages.add(page);
    if (pages.size > maxPdfPages()) throw new Error("That selection has too many pages.");
  }
  const selected = [...pages].sort((a, b) => a - b);
  if (selected.length === 0) throw new Error("Choose at least one page.");
  if (selected.length > maxPdfPages()) throw new Error("That selection has too many pages.");
  return selected;
}
