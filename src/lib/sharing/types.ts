import { z } from "zod";

import { explanationDocumentSchema } from "@/src/lib/explanation/schema";

export const shareSnapshotSchema = z.object({
  conversationId: z.string().uuid(),
  slug: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  document: explanationDocumentSchema,
  showProvider: z.boolean(),
  sharedAt: z.string().datetime(),
  sourceUpdatedAt: z.string().datetime(),
}).strict();

export type ShareSnapshot = z.infer<typeof shareSnapshotSchema>;
export type ShareStatus = {
  active: boolean;
  stale: boolean;
  path?: string;
  showProvider?: boolean;
  sharedAt?: string;
  sourceUpdatedAt?: string;
};

export interface ShareStore {
  getForLesson(id: string): Promise<ShareSnapshot | null>;
  getBySlug(slug: string): Promise<ShareSnapshot | null>;
  replace(snapshot: ShareSnapshot): Promise<void>;
  revoke(id: string): Promise<void>;
}

export function validShareSlug(slug: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(slug);
}
