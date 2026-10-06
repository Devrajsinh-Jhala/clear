import { AudioLines, Brain, FlaskConical, Lightbulb, ListChecks, MessagesSquare, ShieldCheck, SlidersHorizontal, Telescope, Workflow, type LucideIcon } from "lucide-react";

/** Icon and spectrum hue for each lesson view. The hue classes live in globals.css. */
export const VIEW_META: Record<string, { icon: LucideIcon; hue: string }> = {
  understand: { icon: Lightbulb, hue: "hue-understand" },
  "mental-model": { icon: Brain, hue: "hue-mental-model" },
  visual: { icon: Workflow, hue: "hue-visual" },
  interactive: { icon: SlidersHorizontal, hue: "hue-interactive" },
  examples: { icon: FlaskConical, hue: "hue-examples" },
  "deep-dive": { icon: Telescope, hue: "hue-deep-dive" },
  verify: { icon: ShieldCheck, hue: "hue-verify" },
  quiz: { icon: ListChecks, hue: "hue-quiz" },
  "teach-back": { icon: MessagesSquare, hue: "hue-teach-back" },
  voice: { icon: AudioLines, hue: "hue-voice" },
};

/** Classes for one tab in the "Explanation views" tab list. */
export function viewTabClass(selected: boolean): string {
  return `group/tab flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${selected
    ? "tone-bg tone-border font-medium text-foreground shadow-sm"
    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`;
}
