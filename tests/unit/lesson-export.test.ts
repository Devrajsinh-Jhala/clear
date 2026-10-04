import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MUTEX_FIXTURE } from "@/src/lib/explanation/fixtures/mutex";
import { explanationDocumentSchema, type InteractiveWidgetSpec } from "@/src/lib/explanation/schema";
import { projectExplanation, safeMermaidSource } from "@/src/lib/export/document";
import { safeDownloadFilename } from "@/src/lib/export/filename";
import { exportLessonJson } from "@/src/lib/export/json";
import { exportLessonMarkdown } from "@/src/lib/export/markdown";
import { exportLessonPdf, wrapPdfText } from "@/src/lib/export/pdf";

const EXPORTED_AT = "2026-10-04T10:20:30.000Z";
const EXPORT_OPTIONS = { exportedAt: EXPORTED_AT };
const fixture = () => structuredClone(MUTEX_FIXTURE);

describe("lesson projection and readable exports", () => {
  it("whitelists canonical learning data while removing operational and private fields recursively", () => {
    const privateDocument = {
      ...fixture(),
      id: "private-conversation-id",
      normalizedQuestion: "Private pasted source, original question, email and document filename",
      audience: { ...MUTEX_FIXTURE.audience, assumedKnowledge: ["hidden learner profile"], memory: "PRIVATE" },
      metadata: { ...MUTEX_FIXTURE.metadata, provider: "private-provider", model: "private-model", promptVersion: "private-prompt", tokenUsage: { inputTokens: 555 }, latencyMs: 999, credential: "PRIVATE" },
      concepts: MUTEX_FIXTURE.concepts.map((concept) => ({ ...concept, upload: "PRIVATE" })),
      uploads: [{ filename: "PRIVATE" }], conversation: "PRIVATE", credentials: "PRIVATE",
    };
    const projected = projectExplanation(privateDocument, EXPORT_OPTIONS);
    expect(explanationDocumentSchema.safeParse(projected).success).toBe(true);
    expect(projected.id).toBe("clear-export");
    expect(projected.normalizedQuestion).toBe(projected.topic);
    expect(projected.audience.assumedKnowledge).toEqual([]);
    expect(projected.metadata).toEqual({ provider: "hidden", model: "hidden", generatedAt: EXPORTED_AT, promptVersion: "clear-export-v1" });
    expect(JSON.stringify(projected)).not.toMatch(/PRIVATE|private-conversation-id|private-provider|private-model|private-prompt|hidden learner profile|inputTokens|latencyMs/);
    expect(privateDocument.audience.assumedKnowledge).toEqual(["hidden learner profile"]);
    expect(projected.concepts).toEqual(MUTEX_FIXTURE.concepts);
  });

  it("discloses provider identity only by explicit choice, preserving publication time across snapshot exports", () => {
    const projected = projectExplanation(fixture(), { ...EXPORT_OPTIONS, includeProvider: true });
    expect(projected.metadata.provider).toBe(MUTEX_FIXTURE.metadata.provider);
    expect(projected.metadata.model).toBe(MUTEX_FIXTURE.metadata.model);
    const hidden = JSON.parse(exportLessonJson(projected, EXPORT_OPTIONS));
    expect(hidden.metadata.provider).toBe("hidden");
    const disclosed = JSON.parse(exportLessonJson(projected, { ...EXPORT_OPTIONS, includeProvider: true }));
    expect(disclosed.metadata.generatedAt).toBe(EXPORTED_AT);
    expect(disclosed.metadata.provider).toBe(MUTEX_FIXTURE.metadata.provider);
    expect(exportLessonMarkdown(projected, { ...EXPORT_OPTIONS, includeProvider: true })).toContain("Provider:");
    expect(exportLessonMarkdown(projected, EXPORT_OPTIONS)).not.toContain("Provider:");
  });

  it("rejects incomplete canonical documents and invalid publication dates", () => {
    expect(() => projectExplanation({ ...fixture(), concepts: [] }, EXPORT_OPTIONS)).toThrow();
    expect(() => projectExplanation(fixture(), { exportedAt: "not-a-date" })).toThrow("valid export date");
  });

  it("keeps the canonical JSON model readable and complete without exporting a conversation wrapper", () => {
    const text = exportLessonJson(fixture(), EXPORT_OPTIONS);
    const document = JSON.parse(text);
    expect(text).toContain('\n  "schemaVersion": "1.0"');
    for (const key of ["concepts", "relationships", "process", "mentalModel", "terminology", "examples", "visualizations", "interactives", "misconceptions", "deepDive", "verification", "quiz", "followUpSuggestions"] as const) expect(document[key]).toEqual(MUTEX_FIXTURE[key]);
    expect(document).not.toHaveProperty("conversation");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("includes all learning views and separates quiz questions from their answer key", () => {
    const markdown = exportLessonMarkdown(fixture(), EXPORT_OPTIONS);
    for (const heading of ["Understand", "Concepts", "How the concepts connect", "Mental model", "Terms to know", "Examples", "Visual explanations", "Interactive explorations", "Common misconceptions", "Deep dive", "Verify", "Quiz", "Keep exploring", "Quiz answer key"]) expect(markdown).toContain(`## ${heading}`);
    expect(markdown).toContain("```mermaid\nsequenceDiagram");
    expect(markdown).toContain("Where the analogy stops");
    expect(markdown).toContain("not independent proof of accuracy");
    const questionSection = markdown.slice(markdown.indexOf("## Quiz\n"), markdown.indexOf("## Quiz answer key"));
    expect(questionSection).not.toContain("Answer:");
    for (const question of MUTEX_FIXTURE.quiz) expect(markdown.slice(markdown.indexOf("## Quiz answer key"))).toContain(question.explanation);
  });

  it("describes every trusted interactive type without running formulas or code", () => {
    const document = fixture();
    const widgets: InteractiveWidgetSpec[] = [
      { type: "generic-step-flow", title: "Step flow", steps: [{ id: "step", title: "One", detail: "step detail sentinel" }] },
      { type: "binary-search", title: "Search", array: [2, 4, 8], target: 8 },
      { type: "state-machine", title: "States", states: ["idle", "running"], transitions: [{ from: "idle", to: "running", on: "start sentinel" }] },
      { type: "timeline", title: "Time", events: [{ id: "event", label: "First", detail: "timeline sentinel" }] },
      { type: "graph-traversal", title: "Graph", nodes: ["A", "B"], edges: [{ from: "A", to: "B" }], start: "A" },
      { type: "parameter-explorer", title: "Parameters", formula: "α * x + β", parameters: [{ name: "x", min: 1, max: 9, step: 2, initial: 3 }] },
      { type: "code-trace", title: "Code", language: "javascript", code: "throw new Error('inert code sentinel');", steps: [{ id: "line", line: 1, explanation: "code explanation sentinel", locals: [{ name: "x", value: "local sentinel" }] }] },
    ];
    document.interactives = widgets;
    const markdown = exportLessonMarkdown(document, EXPORT_OPTIONS);
    for (const sentinel of ["step detail sentinel", "Sorted values: 2, 4, 8", "start sentinel", "timeline sentinel", "Start at A", "α", "initial 3", "inert code sentinel", "code explanation sentinel", "local sentinel"]) expect(markdown).toContain(sentinel);
  });

  it("exports diagram text but omits unsafe actions, directives, HTML and remote assets", () => {
    for (const source of ["flowchart LR\nclick A javascript:alert(1)", "%%{init: {securityLevel: 'loose'}}%%\nflowchart LR\nA-->B", "flowchart LR\nA[<img src=x>]", "flowchart LR\nA@{img: 'https://example.com/a.png'}", "flowchart LR\nclick A callback"]) {
      expect(safeMermaidSource(source)).toBeUndefined();
      const document = fixture(); document.visualizations[0].mermaid = source;
      const projected = projectExplanation(document, EXPORT_OPTIONS);
      expect(projected.visualizations[0].mermaid).toBeUndefined();
      expect(projected.visualizations[0].textEquivalent).toBe(document.visualizations[0].textEquivalent);
    }
    expect(safeMermaidSource(MUTEX_FIXTURE.visualizations[0].mermaid!)).toBe(MUTEX_FIXTURE.visualizations[0].mermaid);
  });

  it("makes model markup inert and prevents a code snippet from closing its own fence", () => {
    const document = fixture();
    document.essence = '<script>alert(1)</script> ![track](https://example.com/pixel)';
    document.interactives = [{ type: "code-trace", title: "Inert snippet", language: "javascript\nmalicious", code: "```\n<script>inert</script>\n````", steps: [{ id: "step", line: 1, explanation: "A literal string.", locals: [] }] }];
    const markdown = exportLessonMarkdown(document, EXPORT_OPTIONS);
    expect(markdown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markdown).toContain("!\\[track\\](https&#58;//example.com/pixel)");
    expect(markdown).toContain("`````text\n```\n<script>inert</script>\n````\n`````");
    expect(markdown).not.toContain("```javascript\nmalicious");
  });

  it("keeps ordinary prose, numbers, and punctuation readable in the raw Markdown download", () => {
    const document = fixture();
    document.essence = "A mutex (mutual exclusion) lets one thread use a resource. A follow-up can compare version 2.5, C#, x + y, and a - b!";
    document.deepDive[0].body = "Negative values such as -5 and decimal values such as 3.14 remain readable. Example: f(x) = (x + 1) / 2.";
    const markdown = exportLessonMarkdown(document, EXPORT_OPTIONS);
    expect(markdown).toContain(document.essence);
    expect(markdown).toContain(document.deepDive[0].body);
  });

  it("protects model-supplied block markers and automatic links without escaping ordinary punctuation", () => {
    const document = fixture();
    document.essence = [
      "# Injected heading", "1. Injected ordered list", "2) Another list", "- Injected bullet", "+ Another bullet", "---", "===",
      "> Injected quote", "~~~javascript", "    Indented code", "[reference]: https://example.com", "[link](javascript:alert(1))",
      "Bare URLs: https://example.com/path, HTTP://example.com, www.example.com. Email: learner@example.com.",
      "Literal emphasis: *bold* and _italic_. Table: | one | two |.",
    ].join("\n");
    const markdown = exportLessonMarkdown(document, EXPORT_OPTIONS);
    const content = markdown.slice(markdown.indexOf("## Understand\n"), markdown.indexOf("### Why it matters"));
    for (const marker of ["\\# Injected heading", "1\\. Injected ordered list", "2\\) Another list", "\\- Injected bullet", "\\+ Another bullet", "\\---", "\\===", "&gt; Injected quote", "\\~\\~\\~javascript", "&#32;   Indented code", "\\[reference\\]:", "\\[link\\](javascript:alert(1))"]) expect(content).toContain(marker);
    expect(content).toContain("Bare URLs: https&#58;//example.com/path, HTTP&#58;//example.com, www&#46;example.com. Email: learner&#64;example.com.");
    expect(content).toContain("Literal emphasis: \\*bold\\* and \\_italic\\_. Table: \\| one \\| two \\|.");
    expect(content).not.toMatch(/\n(?:#{1,6} |\d+[.)] |[-+] |---$|=== $|> |~~~| {4}\S)/m);
  });

  it("creates an ASCII filename that cannot inject headers, paths, or unsafe extensions", () => {
    expect(safeDownloadFilename('../../Résumé: mutex\r\nContent-Disposition: evil', "pdf")).toBe("clear-resume-mutex-content-disposition-evil.pdf");
    expect(safeDownloadFilename("中文数学", "markdown")).toBe("clear-lesson.md");
    expect(safeDownloadFilename("x".repeat(300), "json").length).toBeLessThan(95);
    expect(() => safeDownloadFilename("topic", "exe" as "pdf")).toThrow();
  });

  it("wraps uninterrupted text using actual width while retaining every character", () => {
    const text = `a very long token ${"β".repeat(101)} followed by   spaces`;
    const font = { widthOfTextAtSize: (value: string, size: number) => Array.from(value).length * size };
    const lines = wrapPdfText(text, font, 2, 24);
    expect(lines.join("")).toBe(text);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 2) <= 24)).toBe(true);
  });

  it("builds a real self-contained paginated PDF with Unicode math, complete long content and separated answers", async () => {
    const document = fixture();
    document.essence = "Greek and math: α β γ δ λ μ π σ Ω Δ ∑ ∫ √ ∞ ≤ ≥ ≠ → x². Unsupported glyph: 你.";
    document.deepDive.push({ id: "long", title: "Long content stress", body: `${"Long explanations stay readable across page boundaries. ".repeat(180)}END-OF-LONG-CONTENT` });
    document.interactives.push({ type: "code-trace", title: "Long code stress", language: "text", code: `start\n${"unbroken_token".repeat(120)}\nend-of-code`, steps: [{ id: "stress", line: 2, explanation: "Long code wraps without clipping.", locals: [] }] });
    const bytes = await exportLessonPdf(document, EXPORT_OPTIONS);
    expect(Buffer.from(bytes).subarray(0, 8).toString()).toMatch(/^%PDF-1\./);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(5);
    expect(pdf.getTitle()).toBe(document.topic);
    const extracted = await extractText(new Uint8Array(bytes), { mergePages: true });
    expect(extracted.text).toContain("α β γ δ λ μ π σ Ω Δ ∑ ∫ √ ∞ ≤ ≥ ≠ → x²");
    expect(extracted.text).toContain("[U+4F60]");
    expect(extracted.text).toContain("Some characters use Unicode codepoint notation");
    expect(extracted.text).toContain("END-OF-LONG-CONTENT");
    expect(extracted.text).toContain("end-of-code");
    expect(extracted.text).toContain("Quiz answer key");
    expect(extracted.text).not.toContain(document.normalizedQuestion);
    expect(extracted.text).not.toContain(document.id);
    if (process.env.CLEAR_EXPORT_QA === "1") {
      const directory = path.join(process.cwd(), ".data", "qa");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "clear-export-stress.pdf"), bytes);
      await writeFile(path.join(directory, "clear-export-sample.pdf"), await exportLessonPdf(fixture(), EXPORT_OPTIONS));
    }
  }, 30_000);
});
