import type { ExplanationDocument, InteractiveWidgetSpec } from "@/src/lib/explanation/schema";

export type ExportBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "code"; text: string; language: string };

/** One semantic outline feeds both readable exports, so views do not lose their content. */
export function lessonExportBlocks(document: ExplanationDocument, includeDiagramCode: boolean): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const heading = (text: string, level: 1 | 2 | 3 = 2) => blocks.push({ kind: "heading", level, text });
  const paragraph = (text: string) => blocks.push({ kind: "paragraph", text });
  const list = (items: string[], ordered = false) => { if (items.length) blocks.push({ kind: "list", items, ordered }); };
  const conceptName = (id: string) => document.concepts.find((concept) => concept.id === id)?.name ?? id;
  heading(document.topic, 1);
  paragraph(`CLEAR learning notes · Published ${new Date(document.metadata.generatedAt).toISOString().slice(0, 10)} · ${document.audience.level} · ${document.audience.desiredDepth} depth`);
  if (document.metadata.provider !== "hidden" || document.metadata.model !== "hidden") paragraph(`Provider: ${document.metadata.provider} · Model: ${document.metadata.model}`);
  heading("Understand");
  paragraph(document.essence);
  heading("Why it matters", 3); paragraph(document.whyItMatters);
  heading("By the end", 3); list(document.learningObjectives.map((objective) => objective.statement));
  if (document.prerequisites.length) { heading("Prerequisites", 3); list(document.prerequisites.map((concept) => concept.name)); }
  heading("Concepts");
  for (const concept of document.concepts) {
    heading(concept.name, 3); paragraph(concept.definition); paragraph(concept.plainExplanation);
    paragraph(`Why this matters: ${concept.importance}`);
    if (concept.dependsOn.length) paragraph(`Builds on: ${concept.dependsOn.map(conceptName).join(", ")}`);
  }
  if (document.relationships.length) {
    heading("How the concepts connect");
    for (const relationship of document.relationships) paragraph(`${conceptName(relationship.from)} → ${conceptName(relationship.to)} (${relationship.type}): ${relationship.explanation}`);
  }
  if (document.process) { heading(document.process.title); list(document.process.steps.map((step) => step.text), true); }
  heading("Mental model"); paragraph(document.mentalModel.intuition);
  if (document.mentalModel.analogy) {
    heading("An analogy", 3); paragraph(document.mentalModel.analogy.description);
    list(document.mentalModel.analogy.mapping.map((mapping) => `${mapping.source} → ${mapping.target}`));
    heading("Where the analogy stops", 3); list(document.mentalModel.analogy.limitations);
  }
  heading("Terms to know");
  for (const term of document.terminology) paragraph(`${term.term}: ${term.definition}`);
  heading("Examples");
  for (const example of document.examples) { heading(example.title, 3); paragraph(example.setup); list(example.walkthrough, true); paragraph(`Takeaway: ${example.takeaway}`); }
  heading("Visual explanations");
  if (!document.visualizations.length) paragraph("This lesson uses the written explanation without a diagram.");
  for (const visual of document.visualizations) {
    heading(visual.title, 3); paragraph(`Diagram type: ${visual.type}`); paragraph(visual.textEquivalent);
    if (includeDiagramCode && visual.mermaid) blocks.push({ kind: "code", language: "mermaid", text: visual.mermaid });
  }
  heading("Interactive explorations");
  if (!document.interactives.length) paragraph("No interactive exploration is included in this lesson.");
  else paragraph("These are written summaries of the lesson's interactive explorations.");
  for (const widget of document.interactives) { heading(widget.title, 3); blocks.push(...interactiveBlocks(widget)); }
  heading("Common misconceptions");
  for (const misconception of document.misconceptions) { heading(misconception.misconception, 3); paragraph(misconception.correction); if (misconception.whyItOccurs) paragraph(`Why it occurs: ${misconception.whyItOccurs}`); }
  heading("Deep dive");
  if (!document.deepDive.length) paragraph("No additional deep dive is included in this lesson.");
  for (const section of document.deepDive) { heading(section.title, 3); paragraph(section.body); }
  heading("Verify");
  paragraph(`Verification ${document.verification.required ? "required" : "not required"} · ${document.verification.performed ? "performed" : "not performed"} · Reported confidence: ${document.verification.confidence}`);
  paragraph("Confidence is the lesson's reported assessment, not independent proof of accuracy.");
  for (const claim of document.verification.claims) { paragraph(`${claim.status.toUpperCase()}: ${claim.statement}`); if (claim.note) paragraph(claim.note); }
  if (document.verification.caveats.length) { heading("Caveats", 3); list(document.verification.caveats); }
  heading("Quiz");
  if (!document.quiz.length) paragraph("No quiz is included in this lesson.");
  else paragraph("Try each question before reading the answer key at the end.");
  document.quiz.forEach((question, index) => {
    heading(`${index + 1}. ${question.question}`, 3);
    paragraph(`Type: ${question.type} · Difficulty: ${question.difficulty}/5 · Concepts: ${question.conceptIds.map(conceptName).join(", ")}`);
    if (question.options?.length) list(question.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`));
  });
  if (document.followUpSuggestions.length) { heading("Keep exploring"); list(document.followUpSuggestions); }
  if (document.quiz.length) {
    heading("Quiz answer key");
    document.quiz.forEach((question, index) => { heading(`Question ${index + 1}`, 3); paragraph(`Answer: ${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(" → ") : question.correctAnswer}`); paragraph(question.explanation); });
  }
  return blocks;
}

function interactiveBlocks(widget: InteractiveWidgetSpec): ExportBlock[] {
  const paragraph = (text: string): ExportBlock => ({ kind: "paragraph", text });
  const list = (items: string[], ordered = false): ExportBlock => ({ kind: "list", items, ordered });
  switch (widget.type) {
    case "generic-step-flow": return [list(widget.steps.map((step) => `${step.title}: ${step.detail}`), true)];
    case "binary-search": return [paragraph(`Sorted values: ${widget.array.join(", ")}. Target: ${widget.target}. Compare the middle value with the target, then keep the half that can contain it until found or the range is empty.`)];
    case "state-machine": return [paragraph(`States: ${widget.states.join(", ")}`), list(widget.transitions.map((transition) => `${transition.from} → ${transition.to}, on ${transition.on}`))];
    case "timeline": return [list(widget.events.map((event) => `${event.label}: ${event.detail}`), true)];
    case "graph-traversal": return [paragraph(`Start at ${widget.start}. Nodes: ${widget.nodes.join(", ")}`), list(widget.edges.map((edge) => `${edge.from} → ${edge.to}`))];
    case "parameter-explorer": return [paragraph(`Formula: ${widget.formula}`), list(widget.parameters.map((parameter) => `${parameter.name}: from ${parameter.min} to ${parameter.max}, step ${parameter.step}, initial ${parameter.initial}`))];
    case "code-trace": return [paragraph(`Language: ${widget.language}`), { kind: "code", text: widget.code, language: /^[a-z0-9+-]+$/i.test(widget.language) ? widget.language : "text" }, list(widget.steps.map((step) => `Line ${step.line}: ${step.explanation}${step.locals.length ? ` Locals: ${step.locals.map((local) => `${local.name} = ${local.value}`).join("; ")}` : ""}`), true)];
  }
}
