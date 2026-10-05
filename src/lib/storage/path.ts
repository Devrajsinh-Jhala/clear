import path from "node:path";

export function dataDirectory(...segments: string[]): string {
  const root = path.resolve(/* turbopackIgnore: true */ process.env.CLEAR_DATA_DIR || path.join(process.cwd(), ".data"));
  return path.join(/* turbopackIgnore: true */ root, ...segments);
}

export function assertLocalPersistence(): void {
  if (process.env.VERCEL === "1") throw new Error("Configure Supabase before using persistent CLEAR storage on Vercel.");
}
