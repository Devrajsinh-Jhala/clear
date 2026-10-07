"use client";

import { ArrowRight, Check, MousePointer2 } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { useReducedMotion, useStages } from "@/components/landing/motion";
import { VIEW_META } from "@/components/lesson/view-meta";

const VIEWS = [
  ["understand", "Understand"],
  ["mental-model", "Mental model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["quiz", "Quiz"],
  ["teach-back", "Teach it back"],
] as const;
const VIEW_MS = 5600;

const order = (index: number) => ({ "--i": index }) as CSSProperties;

/**
 * A preview of one lesson moving through its views, each one assembling the way
 * the real view reads. It is decoration: the page describes the same thing in
 * text, so it is hidden from assistive technology. It stays on the first view,
 * fully drawn, when the visitor prefers reduced motion.
 */
export function ProductPreview() {
  const still = useReducedMotion();
  const [view, setView] = useState(0);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (still || paused) return;
    const timer = window.setInterval(() => setView((current) => (current + 1) % VIEWS.length), VIEW_MS);
    return () => window.clearInterval(timer);
  }, [paused, still, run]);

  const [id] = VIEWS[view];
  return (
    <div
      aria-hidden="true"
      className="surface-panel overflow-hidden shadow-[0_30px_70px_-34px_hsl(var(--shadow-color)/38%)]"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => {
        setPaused(false);
        setRun((count) => count + 1);
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
          <LogoMark className="size-5 shrink-0" />
          <span className="truncate">Why does virtual memory exist?</span>
        </p>
        <span className="badge hidden shrink-0 sm:inline-flex">Gemini 3.5 Flash-Lite</span>
      </div>
      <div className="flex overflow-hidden border-b border-border px-2 [mask-image:linear-gradient(to_right,black_88%,transparent)]">
        {VIEWS.map(([viewId, label], index) => {
          const Icon = VIEW_META[viewId].icon;
          const selected = index === view;
          return (
            <div
              key={viewId}
              onClick={() => {
                setView(index);
                setRun((count) => count + 1);
              }}
              className={`relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs transition-colors sm:text-[13px] ${selected ? "border-primary/25 font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              <Icon className={`size-3.5 ${selected ? "text-primary" : ""}`} />
              <span className={selected ? "" : "hidden sm:inline"}>{label}</span>
              {selected ? (
                <span
                  key={`${view}-${run}`}
                  className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-primary"
                  style={still ? undefined : { animation: `fill-x ${VIEW_MS}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div key={id} className="h-[19.5rem] overflow-hidden p-5 text-left sm:h-[18rem] sm:p-6">
        {id === "understand" ? <UnderstandPanel /> : null}
        {id === "mental-model" ? <MentalModelPanel /> : null}
        {id === "visual" ? <VisualPanel still={still} /> : null}
        {id === "interactive" ? <InteractivePanel still={still} /> : null}
        {id === "quiz" ? <QuizPanel still={still} /> : null}
        {id === "teach-back" ? <TeachBackPanel /> : null}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="rise text-xs font-medium text-muted-foreground">{children}</p>;
}

function UnderstandPanel() {
  return (
    <div>
      <Label>The idea in one sentence</Label>
      <p className="rise mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl" style={order(1)}>
        Virtual memory gives every program its own private map of memory, so programs cannot overwrite each other and can use more memory than the machine has.
      </p>
      <p className="rise mt-3 hidden text-sm leading-relaxed text-muted-foreground sm:block" style={order(3)}>
        Why it matters: without it, one faulty program could overwrite the memory of every other program.
      </p>
      <p className="rise mt-5 text-xs font-medium text-muted-foreground" style={order(5)}>Concepts</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {["Address space", "Page table", "MMU", "Page fault"].map((concept, index) => (
          <span key={concept} className="pop rounded-md border border-border bg-muted/60 px-2.5 py-1 text-sm" style={order(6 + index)}>{concept}</span>
        ))}
      </div>
    </div>
  );
}

function MentalModelPanel() {
  const rows = [
    ["Coat-check ticket", "Virtual address"],
    ["Attendant's ledger", "Page table"],
    ["Hook on the wall", "Physical frame"],
  ];
  return (
    <div>
      <Label>Analogy, with its limits</Label>
      <div className="mt-3 overflow-hidden rounded-lg border border-border text-sm">
        {rows.map(([source, target], index) => (
          <div key={source} className="rise grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0" style={order(1 + index * 3)}>
            <span className="text-muted-foreground">{source}</span>
            <ArrowRight className="size-3.5 text-primary" />
            <span className="font-medium">{target}</span>
          </div>
        ))}
      </div>
      <p className="rise mt-4 text-sm leading-relaxed text-muted-foreground" style={order(11)}>
        Where it stops: a coat stays on its hook. A page can be moved to disk and brought back.
      </p>
    </div>
  );
}

function VisualPanel({ still }: { still: boolean }) {
  const boxes = [
    [10, 70, "Program"],
    [180, 70, "MMU"],
    [350, 70, "RAM"],
    [180, 0, "Page table"],
    [350, 140, "Disk"],
  ] as const;
  const lines = ["M130 92h50", "M240 70V45", "M300 92h50"];
  return (
    <div>
      <Label>Diagram · how an address is translated</Label>
      <svg viewBox="0 0 470 185" className="mt-3 h-52 w-full sm:h-56" fill="none">
        <g stroke="var(--muted-foreground)" strokeWidth="1.25" strokeLinecap="round">
          {lines.map((path, index) => <path key={path} d={path} pathLength="1" className="draw" style={{ "--i": 3 + index * 3 } as CSSProperties} />)}
          <path d="M410 115v25" strokeDasharray="4 4" className="rise" style={order(12)} />
        </g>
        {boxes.map(([x, y, label], index) => (
          <g key={label} className="pop" style={{ "--i": index * 3, transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}>
            <rect x={x} y={y} width="120" height="45" rx="8" fill={label === "MMU" ? "var(--accent)" : "var(--card)"} stroke={label === "MMU" ? "var(--primary)" : "var(--border)"} strokeWidth="1.25" />
            <text x={x + 60} y={y + 27} textAnchor="middle" fill="var(--foreground)" fontSize="13.5" fontFamily="var(--font-geist-sans)">{label}</text>
          </g>
        ))}
        <g className="rise" style={order(10)}>
          <text x="155" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">virtual</text>
          <text x="325" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">physical</text>
          <text x="418" y="132" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">page fault</text>
        </g>
        {still ? null : (
          <circle r="4.5" fill="var(--primary)">
            <animateMotion dur="2.4s" begin="1.5s" repeatCount="indefinite" path="M130 92H350" />
          </circle>
        )}
      </svg>
    </div>
  );
}

function InteractivePanel({ still }: { still: boolean }) {
  const steps = [
    "The program reads virtual address 0x4A10.",
    "The MMU looks up page 0x4 in the page table.",
    "The table says frame 0x9; the MMU adds offset 0xA10.",
    "RAM returns the byte at physical address 0x9A10.",
  ];
  const current = useStages(steps.length - 1, 1150, still);
  return (
    <div>
      <Label>Step through one memory access · step {current + 1} of {steps.length}</Label>
      <ol className="mt-3 space-y-2">
        {steps.map((text, index) => (
          <li key={text} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ${index === current ? "border-primary/40 bg-accent" : index < current ? "border-border text-muted-foreground" : "border-border text-muted-foreground/70"}`}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors duration-300 ${index <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < current ? <Check className="size-3" /> : index + 1}</span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuizPanel({ still }: { still: boolean }) {
  const options = ["They overwrite each other's data.", "Each page table maps it to a different frame.", "The second program crashes."];
  // 0 waiting, 1 pointer arrives, 2 chosen, 3 marked correct
  const stage = useStages(3, 850, still);
  return (
    <div>
      <Label>Check it clicked</Label>
      <p className="rise mt-3 font-medium leading-snug" style={order(1)}>Two programs both use address 0x4000. What happens?</p>
      <div className="relative mt-3 space-y-2">
        {options.map((option, index) => {
          const chosen = index === 1 && stage >= 2;
          const correct = chosen && stage >= 3;
          return (
            <div key={option} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ${correct ? "border-success/50 bg-success/8" : chosen ? "border-primary/50 bg-accent" : index === 1 && stage === 1 ? "border-input" : "border-border"}`}>
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${correct ? "border-success bg-success text-background" : chosen ? "border-primary" : "border-input"}`}>
                {correct ? <Check className="size-3" /> : chosen ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              </span>
              {option}
            </div>
          );
        })}
        {still ? null : (
          <span className={`pointer-events-none absolute left-[62%] top-1/2 transition-all duration-700 ease-out ${stage === 0 ? "translate-x-16 translate-y-24 opacity-0" : stage >= 3 ? "translate-x-3 translate-y-2 opacity-0" : "translate-x-0 translate-y-0 opacity-100"}`}>
            {stage === 2 ? <span className="absolute -left-2 -top-2 size-6 rounded-full border-2 border-primary" style={{ animation: "click-ring 0.5s ease-out both" }} /> : null}
            <MousePointer2 className="size-5 fill-foreground text-background drop-shadow" />
          </span>
        )}
      </div>
      <p className={`mt-3 text-sm text-muted-foreground transition-opacity duration-500 ${stage >= 3 ? "opacity-100" : "opacity-0"}`}>Correct. Same virtual address, different page tables.</p>
    </div>
  );
}

function TeachBackPanel() {
  return (
    <div>
      <Label>Teach it back in your own words</Label>
      <p className="rise mt-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed" style={order(1)}>
        &ldquo;Each program gets its own fake address space. The MMU translates every address through a page table, so two programs never touch the same memory.&rdquo;
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="rise flex items-center gap-2" style={order(7)}><Check className="size-4 text-success" />Isolation is explained</li>
        <li className="rise flex items-center gap-2" style={order(10)}><Check className="size-4 text-success" />Translation is explained</li>
        <li className="rise flex items-center gap-2 text-muted-foreground" style={order(13)}><span className="flex size-4 items-center justify-center"><span className="size-1.5 rounded-full bg-warning" /></span>Still missing: what a page fault does</li>
      </ul>
    </div>
  );
}
