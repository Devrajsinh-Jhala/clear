"use client";

import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { VIEW_META } from "@/components/lesson/view-meta";

const VIEWS = [
  ["understand", "Understand"],
  ["mental-model", "Mental model"],
  ["visual", "Visual"],
  ["interactive", "Interactive"],
  ["quiz", "Quiz"],
  ["teach-back", "Teach it back"],
] as const;
const VIEW_MS = 5200;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(notify: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/**
 * A preview of one lesson moving through its views. It is decoration: the page
 * describes the same thing in text, so it is hidden from assistive technology.
 * It stays on the first view when the visitor prefers reduced motion.
 */
export function ProductPreview() {
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => true);
  const [view, setView] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const timer = window.setInterval(() => setView((current) => (current + 1) % VIEWS.length), VIEW_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduced]);

  const [id] = VIEWS[view];
  return (
    <div aria-hidden="true" className="surface-panel overflow-hidden shadow-[0_24px_60px_-28px_hsl(var(--shadow-color)/30%)]" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
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
              onClick={() => setView(index)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs transition-colors sm:text-[13px] ${selected ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              <Icon className={`size-3.5 ${selected ? "text-primary" : ""}`} />
              <span className={selected ? "" : "hidden sm:inline"}>{label}</span>
            </div>
          );
        })}
      </div>
      <div key={id} className="h-[19.5rem] animate-fade-in overflow-hidden p-5 text-left sm:h-[18rem] sm:p-6">
        {id === "understand" ? <UnderstandPanel /> : null}
        {id === "mental-model" ? <MentalModelPanel /> : null}
        {id === "visual" ? <VisualPanel /> : null}
        {id === "interactive" ? <InteractivePanel /> : null}
        {id === "quiz" ? <QuizPanel /> : null}
        {id === "teach-back" ? <TeachBackPanel /> : null}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

function UnderstandPanel() {
  return (
    <div>
      <Label>The idea in one sentence</Label>
      <p className="mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
        Virtual memory gives every program its own private map of memory, so programs cannot overwrite each other and can use more memory than the machine has.
      </p>
      <p className="mt-3 hidden text-sm leading-relaxed text-muted-foreground sm:block">Why it matters: without it, one faulty program could overwrite the memory of every other program.</p>
      <Label><span className="mt-5 block">Concepts</span></Label>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {["Address space", "Page table", "MMU", "Page fault"].map((concept) => (
          <span key={concept} className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-sm">{concept}</span>
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
        {rows.map(([source, target]) => (
          <div key={source} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
            <span className="text-muted-foreground">{source}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{target}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Where it stops: a coat stays on its hook. A page can be moved to disk and brought back.
      </p>
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
      <Label>Diagram · how an address is translated</Label>
      <svg viewBox="0 0 470 185" className="mt-3 h-52 w-full sm:h-56" fill="none">
        <g stroke="var(--muted-foreground)" strokeWidth="1.25" strokeLinecap="round">
          <path d="M130 92h50" />
          <path d="M240 70V45" />
          <path d="M300 92h50" />
          <path d="M410 115v25" strokeDasharray="4 4" />
        </g>
        {boxes.map(([x, y, label]) => (
          <g key={label}>
            <rect x={x} y={y} width="120" height="45" rx="8" fill={label === "MMU" ? "var(--accent)" : "var(--card)"} stroke={label === "MMU" ? "var(--primary)" : "var(--border)"} strokeWidth="1.25" />
            <text x={x + 60} y={y + 27} textAnchor="middle" fill="var(--foreground)" fontSize="13.5" fontFamily="var(--font-geist-sans)">{label}</text>
          </g>
        ))}
        <text x="155" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">virtual</text>
        <text x="325" y="84" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">physical</text>
        <text x="418" y="132" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-geist-mono)">page fault</text>
      </svg>
    </div>
  );
}

function InteractivePanel() {
  const steps = [
    "The program reads virtual address 0x4A10.",
    "The MMU looks up page 0x4 in the page table.",
    "The table says frame 0x9; the MMU adds offset 0xA10.",
    "RAM returns the byte at physical address 0x9A10.",
  ];
  const current = 2;
  return (
    <div>
      <Label>Step through one memory access · step 3 of 4</Label>
      <ol className="mt-3 space-y-2">
        {steps.map((text, index) => (
          <li key={text} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${index === current ? "border-primary/40 bg-accent" : index < current ? "border-border text-muted-foreground" : "border-border text-muted-foreground/70"}`}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${index <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index < current ? <Check className="size-3" /> : index + 1}</span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuizPanel() {
  const options = ["They overwrite each other's data.", "Each page table maps it to a different frame.", "The second program crashes."];
  return (
    <div>
      <Label>Check it clicked</Label>
      <p className="mt-3 font-medium leading-snug">Two programs both use address 0x4000. What happens?</p>
      <div className="mt-3 space-y-2">
        {options.map((option, index) => (
          <div key={option} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${index === 1 ? "border-success/50 bg-success/8" : "border-border"}`}>
            <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${index === 1 ? "border-success bg-success text-background" : "border-input"}`}>{index === 1 ? <Check className="size-3" /> : null}</span>
            {option}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Correct. Same virtual address, different page tables.</p>
    </div>
  );
}

function TeachBackPanel() {
  return (
    <div>
      <Label>Teach it back in your own words</Label>
      <p className="mt-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed">
        &ldquo;Each program gets its own fake address space. The MMU translates every address through a page table, so two programs never touch the same memory.&rdquo;
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2"><Check className="size-4 text-success" />Isolation is explained</li>
        <li className="flex items-center gap-2"><Check className="size-4 text-success" />Translation is explained</li>
        <li className="flex items-center gap-2 text-muted-foreground"><span className="flex size-4 items-center justify-center"><span className="size-1.5 rounded-full bg-warning" /></span>Still missing: what a page fault does</li>
      </ul>
    </div>
  );
}
