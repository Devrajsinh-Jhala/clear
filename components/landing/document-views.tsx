"use client";

import { useState } from "react";

import { PointerGlow } from "@/components/landing/pointer-glow";
import { VIEW_META } from "@/components/lesson/view-meta";

// The fields of one explanation document, in the order the schema declares them,
// with a short preview of the virtual memory lesson shown in the hero.
const FIELDS: Array<[key: string, preview: string]> = [
  ["essence", '"Every program gets its own private map of memory…"'],
  ["whyItMatters", '"Without it, one faulty program could overwrite…"'],
  ["prerequisites", "[ RAM, process ]"],
  ["concepts", "[ address space, page table, MMU, page fault ]"],
  ["process", "{ steps: 4 }"],
  ["mentalModel", "{ intuition, analogy: { mapping, limitations } }"],
  ["terminology", "[ 6 terms ]"],
  ["examples", "[ 2 worked examples ]"],
  ["visualizations", "[ 1 diagram with a text version ]"],
  ["interactives", "[ 1 step-through ]"],
  ["misconceptions", "[ 2 ]"],
  ["deepDive", "[ 2 sections ]"],
  ["verification", '{ performed: false, confidence: "high" }'],
  ["quiz", "[ 3 questions ]"],
];

// Which fields each view reads. This mirrors the view components in components/lesson.
const VIEWS: Array<{ id: string; title: string; text: string; reads: string[] }> = [
  { id: "understand", title: "Understand", text: "The idea in one precise sentence, then the mechanism and the terms.", reads: ["essence", "whyItMatters", "prerequisites", "concepts", "process", "terminology"] },
  { id: "mental-model", title: "Mental model", text: "An intuition and an analogy that says where it stops being true.", reads: ["mentalModel", "misconceptions"] },
  { id: "visual", title: "Visual", text: "Diagrams drawn from the explanation, each with a text version.", reads: ["visualizations"] },
  { id: "interactive", title: "Interactive", text: "Step through a trace or move a parameter. Model-written code never runs.", reads: ["interactives"] },
  { id: "examples", title: "Examples", text: "Worked examples, one step at a time.", reads: ["examples"] },
  { id: "deep-dive", title: "Deep dive", text: "Assumptions, edge cases and specialist detail.", reads: ["deepDive"] },
  { id: "verify", title: "Verify", text: "What was checked, what was not, and how confident the lesson is.", reads: ["verification"] },
  { id: "quiz", title: "Quiz", text: "Questions that test the mechanism, not the wording.", reads: ["quiz"] },
  { id: "teach-back", title: "Teach it back", text: "Explain it yourself. CLEAR finds what is missing or wrong.", reads: ["essence", "concepts"] },
  { id: "voice", title: "Voice tutor", text: "Listen to the lesson, or ask your follow-up out loud.", reads: ["essence", "whyItMatters", "process", "mentalModel", "examples"] },
];

function sentence(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * Ten views beside the one document they are drawn from. Choosing a view marks the
 * fields it reads. The sentence under the views says the same thing in words; the
 * document panel itself is a picture of that sentence and is hidden from assistive technology.
 */
export function DocumentViews() {
  const [active, setActive] = useState(0);
  const view = VIEWS[active];

  return (
    <div className="mt-12 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
      <div>
        <PointerGlow>
          <ul className="glow-lines grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border" aria-label="Lesson views">
            {VIEWS.map((item, index) => {
              const Icon = VIEW_META[item.id].icon;
              const selected = index === active;
              return (
                <li key={item.id} className="bg-card">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActive(index)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setActive(index);
                    }}
                    onFocus={() => setActive(index)}
                    className={`group flex h-full w-full flex-col items-start gap-2 p-4 text-left transition-colors sm:p-5 ${selected ? "bg-accent/70" : "hover:bg-muted/50"}`}
                  >
                    <span className={`flex size-8 items-center justify-center rounded-lg border transition-all duration-300 ${selected ? "border-primary/40 bg-primary text-primary-foreground" : "border-border bg-background text-primary group-hover:-translate-y-0.5"}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-medium">{item.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{item.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PointerGlow>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{view.title}</span> reads {sentence(view.reads)}.
        </p>
      </div>
      <div className="surface-panel overflow-hidden lg:sticky lg:top-20" aria-hidden="true">
        <p className="flex items-center justify-between border-b border-border px-4 py-3 font-mono text-xs text-muted-foreground">
          <span>explanation.json</span>
          <span>one document</span>
        </p>
        <div className="p-2 font-mono text-[12.5px] leading-6 sm:p-3 sm:text-[13px]">
          <p className="px-2 text-muted-foreground">{"{"}</p>
          {FIELDS.map(([key, preview]) => {
            const read = view.reads.includes(key);
            return (
              <p key={key} className={`flex gap-2 rounded-md px-2 transition-all duration-300 ${read ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
                <span className={`shrink-0 transition-colors duration-300 ${read ? "font-medium text-primary" : ""}`}>
                  <span className={`mr-2 inline-block size-1.5 rounded-full align-middle transition-colors duration-300 ${read ? "bg-primary" : "bg-border"}`} />
                  {key}:
                </span>
                <span className="truncate">{preview}</span>
              </p>
            );
          })}
          <p className="px-2 text-muted-foreground">{"}"}</p>
        </div>
      </div>
    </div>
  );
}
