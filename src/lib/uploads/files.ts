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
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

export function maxPdfPages(): number {
  const pages = Number(process.env.MAX_PDF_PAGES || 40);
  return Number.isFinite(pages) && pages > 0 ? pages : 40;
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
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const range = piece.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > pageCount) {
        throw new Error("That page range is outside the document.");
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    if (!/^\d+$/.test(piece)) throw new Error("Use page numbers like 1-3, 5.");
    const page = Number(piece);
    if (page < 1 || page > pageCount) throw new Error("That page is outside the document.");
    pages.add(page);
  }
  const selected = [...pages].sort((a, b) => a - b);
  if (selected.length === 0) throw new Error("Choose at least one page.");
  if (selected.length > maxPdfPages()) throw new Error("That selection has too many pages.");
  return selected;
}
