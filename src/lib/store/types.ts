import type { Depth, ExplanationDocument, LearnerLevel } from "@/src/lib/explanation/schema";

export type LessonAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageName: string;
  pageCount?: number;
  extractedText?: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  kind?: "follow-up" | "teach-back";
};

export type ConversationRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeProvider: string;
  activeModel: string;
  level: LearnerLevel;
  depth: Depth;
  messages: ConversationMessage[];
  document: ExplanationDocument | null;
  attachments?: LessonAttachment[];
};

export interface ConversationStore {
  get(id: string): Promise<ConversationRecord | null>;
  save(record: ConversationRecord): Promise<void>;
}
