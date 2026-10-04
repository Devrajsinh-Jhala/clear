import { explanationDocumentSchema, type ExplanationDocument } from "@/src/lib/explanation/schema";

export type ExportOptions = { includeProvider?: boolean; exportedAt?: string };

/** Only the canonical, learner-facing document may cross a sharing/export boundary. */
export function projectExplanation(document: ExplanationDocument, options: ExportOptions = {}): ExplanationDocument {
  const parsed = explanationDocumentSchema.parse(document);
  const timestamp = options.exportedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Choose a valid export date.");
  return explanationDocumentSchema.parse({
    ...parsed,
    id: "clear-export",
    normalizedQuestion: parsed.topic,
    audience: { level: parsed.audience.level, desiredDepth: parsed.audience.desiredDepth, assumedKnowledge: [] },
    visualizations: parsed.visualizations.map(({ mermaid, ...visual }) => {
      const safeSource = mermaid ? safeMermaidSource(mermaid) : undefined;
      return safeSource ? { ...visual, mermaid: safeSource } : visual;
    }),
    metadata: {
      provider: options.includeProvider ? parsed.metadata.provider : "hidden",
      model: options.includeProvider ? parsed.metadata.model : "hidden",
      generatedAt: timestamp,
      promptVersion: "clear-export-v1",
    },
  });
}

/** Export diagram source as inert code; reject directives, actions, markup and external assets. */
export function safeMermaidSource(source: string): string | undefined {
  if (source.length > 50_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) return;
  if (/%%\s*\{|\b(?:click|href|callback|javascript|image)\b|(?:https?|data|file):|<\/?[a-z!]|@\s*\{|url\s*\(/iu.test(source)) return;
  if (!/^\s*(?:flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|timeline|classDiagram|erDiagram|mindmap|block-beta|architecture-beta|journey|gantt|pie|quadrantChart)\b/u.test(source)) return;
  return source;
}
