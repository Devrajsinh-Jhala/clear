"use client";

import { Check, CornerDownLeft } from "lucide-react";
import { useEffect, useReducer, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { VIEW_META } from "@/components/lesson/view-meta";

const QUESTION = "Why does virtual memory exist?";
const VIEWS = [
  ["understand", "Understand"],
  ["mental-model", "Mental model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["quiz", "Quiz"],
  ["teach-back", "Teach it back"],
] as const;
const TICK_MS = 900;
const TICKS_PER_VIEW = 6;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(notify: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

type State = { view: number; phase: number };
type Action = { type: "tick" } | { type: "show"; view: number };
function reduce(state: State, action: Action): State {
  if (action.type === "show") return { view: action.view, phase: 0 };
  return state.phase + 1 >= TICKS_PER_VIEW ? { view: (state.view + 1) % VIEWS.length, phase: 0 } : { ...state, phase: state.phase + 1 };
}

/**
 * A looping preview of one lesson moving through its views. It is decoration:
 * the page describes the same thing in text, so this is hidden from assistive technology.
 */
export function HeroDemo() {
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false);
  const [typed, setTyped] = useState(0);
  const [paused, setPaused] = useState(false);
  const [{ view, phase }, dispatch] = useReducer(reduce, { view: 0, phase: 0 });
  const asked = reduced || typed >= QUESTION.length;

  useEffect(() => {
    if (reduced || typed >= QUESTION.length) return;
    const timer = window.setTimeout(() => setTyped((count) => count + 1), typed === 0 ? 700 : 42);
    return () => window.clearTimeout(timer);
  }, [reduced, typed]);

  useEffect(() => {
    if (reduced || paused || !asked) return;
    const timer = window.setInterval(() => dispatch({ type: "tick" }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [asked, paused, reduced]);

  const [id] = VIEWS[view];
  const step = reduced ? TICKS_PER_VIEW : phase;

  return (
    <div aria-hidden="true" className="relative mx-auto max-w-4xl" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="bg-spectrum absolute inset-x-10 -top-6 h-40 animate-pan rounded-full opacity-35 blur-3xl dark:opacity-25" />
      <div className="surface-panel relative overflow-hidden !rounded-3xl shadow-2xl">
        <div className="bg-spectrum h-1 animate-pan" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="badge ml-3 !py-0.5 font-mono text-[11px]">CLEAR Free · Gemini</span>
        </div>
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
          <p className="min-h-7 flex-1 text-left font-heading text-lg sm:text-xl">
            {reduced ? QUESTION : QUESTION.slice(0, typed)}
            {asked ? null : <span className="ml-0.5 inline-block h-5 w-0.5 animate-caret bg-primary align-middle" />}
          </p>
          <span className={`flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 ${asked ? "scale-100" : "scale-75 opacity-50"}`}>
            <CornerDownLeft className="size-4" />
          </span>
        </div>
        <div>
          <div className="flex gap-1.5 overflow-hidden px-3 pt-3 sm:px-5">
            {VIEWS.map(([viewId, label], index) => {
              const { icon: Icon, hue } = VIEW_META[viewId];
              const selected = index === view;
              return (
                <div
                  key={viewId}
                  onClick={() => dispatch({ type: "show", view: index })}
                  className={`${hue} relative flex shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-1.5 text-xs transition-all sm:text-sm ${selected ? "tone-bg tone-border font-medium" : "border-transparent text-muted-foreground"}`}
                >
                  <Icon className={`size-3.5 ${selected ? "tone-text" : ""}`} />
                  <span className={selected ? "" : "hidden sm:inline"}>{label}</span>
                  {selected && asked && !reduced ? (
                    <span key={`${view}-${paused}`} className="tone-dot absolute inset-x-0 bottom-0 h-0.5 origin-left" style={{ animation: `fill-x ${TICK_MS * TICKS_PER_VIEW}ms linear both`, animationPlayState: paused ? "paused" : "running" }} />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div key={id} className={`${VIEW_META[id].hue} h-[19rem] animate-fade-up overflow-hidden px-4 py-5 text-left [animation-duration:450ms] sm:h-72 sm:px-6`}>
            {id === "understand" ? <UnderstandPanel step={step} /> : null}
            {id === "mental-model" ? <MentalModelPanel step={step} /> : null}
            {id === "visual" ? <VisualPanel /> : null}
            {id === "interactive" ? <InteractivePanel step={step} /> : null}
            {id === "quiz" ? <QuizPanel step={step} /> : null}
            {id === "teach-back" ? <TeachBackPanel step={step} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Appear({ when, children, className = "" }: { when: boolean; children: ReactNode; className?: string }) {
  return <div className={`transition-all duration-500 ${when ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} ${className}`}>{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="tone-text font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">{children}</p>;
}

function UnderstandPanel({ step }: { step: number }) {
  return (
    <div>
      <Label>The idea in one sentence</Label>
      <p className="mt-3 font-heading text-xl leading-snug sm:text-2xl">
        Virtual memory gives every program its own private map of memory, so programs cannot overwrite each other and can use more memory than the machine has.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Address space", "Page table", "MMU", "Page fault"].map((concept, index) => (
          <Appear key={concept} when={step > index}>
            <span className="tone-bg tone-border inline-block rounded-full border px-3 py-1 text-sm">{concept}</span>
          </Appear>
        ))}
      </div>
    </div>
  );
}

function MentalModelPanel({ step }: { step: number }) {
  const rows = [
    ["Coat-check ticket", "Virtual address"],
    ["Attendant's ledger", "Page table"],
    ["Hook on the wall", "Physical frame"],
  ];
  return (
    <div>
      <Label>Mental model · analogy</Label>
      <div className="mt-3 space-y-2">
        {rows.map(([source, target], index) => (
          <Appear key={source} when={step > index} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm sm:gap-3 sm:text-base">
            <span className="rounded-xl border border-border bg-background px-3 py-2">{source}</span>
            <span className="tone-text font-mono">→</span>
            <span className="tone-bg tone-border rounded-xl border px-3 py-2 font-medium">{target}</span>
          </Appear>
        ))}
      </div>
      <Appear when={step > 3} className="mt-4 text-sm text-muted-foreground">
        Where it stops: a coat stays on its hook. A page can be moved to disk and brought back.
      </Appear>
    </div>
  );
}

function VisualPanel() {
  const boxes = [
    [10, 70, "Program"],
    [180, 70, "MMU"],
    [350, 70, "RAM"],
    [180, 0, "Page table"],
    [350, 140, "Disk"],
  ] as const;
  return (
    <div>
      <Label>Visual · how an address is translated</Label>
      <svg viewBox="0 0 470 185" className="mt-3 h-52 w-full sm:h-56" fill="none">
        <g stroke="oklch(var(--tone-l) var(--tone-c) var(--hue))" strokeWidth="1.5" strokeLinecap="round">
          <path className="stroke-draw" style={{ "--length": 60 } as CSSProperties} d="M130 92h50" />
          <path className="stroke-draw" style={{ "--length": 60, "--delay": "500ms" } as CSSProperties} d="M240 70V45" />
          <path className="stroke-draw" style={{ "--length": 60, "--delay": "1000ms" } as CSSProperties} d="M300 92h50" />
          <path className="stroke-draw" style={{ "--length": 60, "--delay": "1500ms" } as CSSProperties} d="M410 115v25" strokeDasharray="4 5" />
        </g>
        {boxes.map(([x, y, label], index) => (
          <g key={label} className="animate-pop" style={{ animationDelay: `${index * 180}ms`, transformOrigin: `${x + 60}px ${y + 22}px` }}>
            <rect x={x} y={y} width="120" height="45" rx="12" fill="var(--background)" stroke="var(--border)" strokeWidth="1.5" />
            <text x={x + 60} y={y + 28} textAnchor="middle" fill="var(--foreground)" fontSize="14" fontFamily="var(--font-geist-sans)">{label}</text>
          </g>
        ))}
        <text x="155" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">virtual</text>
        <text x="325" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">physical</text>
        <text x="418" y="132" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">page fault</text>
        <circle r="5" className="tone-dot" fill="oklch(0.68 0.19 var(--hue))">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M130 92H180M180 92H300M300 92H350" />
        </circle>
      </svg>
    </div>
  );
}

function InteractivePanel({ step }: { step: number }) {
  const steps = [
    "The program reads virtual address 0x4A10.",
    "The MMU looks up page 0x4 in the page table.",
    "The table says: frame 0x9. The MMU adds the offset 0xA10.",
    "RAM returns the byte at physical address 0x9A10.",
  ];
  const current = Math.min(step, steps.length - 1);
  return (
    <div>
      <Label>Interactive · step through one access</Label>
      <ol className="mt-3 space-y-2">
        {steps.map((text, index) => (
          <li key={text} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-500 sm:text-base ${index === current ? "tone-bg tone-border" : index < current ? "border-border opacity-60" : "border-transparent opacity-40"}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${index <= current ? "tone-dot text-white" : "bg-muted"}`}>{index < current ? <Check className="size-3.5" /> : index + 1}</span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuizPanel({ step }: { step: number }) {
  const options = ["They overwrite each other's data.", "Each page table maps it to a different frame.", "The second program crashes."];
  return (
    <div>
      <Label>Quiz · check it clicked</Label>
      <p className="mt-3 font-heading text-lg leading-snug sm:text-xl">Two programs both use address 0x4000. What happens?</p>
      <div className="mt-3 space-y-2">
        {options.map((option, index) => {
          const chosen = index === 1 && step >= 2;
          const graded = chosen && step >= 3;
          return (
            <div key={option} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-300 sm:text-base ${graded ? "border-success/60 bg-success/10" : chosen ? "tone-bg tone-border" : "border-border"}`}>
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${graded ? "border-success bg-success text-background" : chosen ? "tone-border" : "border-input"}`}>{graded ? <Check className="size-3.5" /> : chosen ? <span className="tone-dot size-2 rounded-full" /> : null}</span>
              {option}
            </div>
          );
        })}
      </div>
      <Appear when={step >= 4} className="mt-3 text-sm text-muted-foreground">Correct. Same virtual address, different page tables.</Appear>
    </div>
  );
}

function TeachBackPanel({ step }: { step: number }) {
  return (
    <div>
      <Label>Teach it back · in your own words</Label>
      <p className="mt-3 rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed sm:text-base">
        &ldquo;Each program gets its own fake address space. The MMU translates every address through a page table, so two programs never touch the same memory.&rdquo;
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Appear when={step >= 2}><span className="inline-flex items-center gap-1.5 rounded-full border border-success/50 bg-success/10 px-3 py-1"><Check className="size-3.5 text-success" />Isolation</span></Appear>
        <Appear when={step >= 3}><span className="inline-flex items-center gap-1.5 rounded-full border border-success/50 bg-success/10 px-3 py-1"><Check className="size-3.5 text-success" />Translation</span></Appear>
        <Appear when={step >= 4}><span className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1">Still missing: what a page fault does</span></Appear>
      </div>
    </div>
  );
}
