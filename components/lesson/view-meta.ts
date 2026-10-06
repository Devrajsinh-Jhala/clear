import { AudioLines, Brain, FlaskConical, Lightbulb, ListChecks, MessagesSquare, ShieldCheck, SlidersHorizontal, Telescope, Workflow, type LucideIcon } from "lucide-react";

/** Icon for each lesson view. */
export const VIEW_META: Record<string, { icon: LucideIcon }> = {
  understand: { icon: Lightbulb },
  "mental-model": { icon: Brain },
  visual: { icon: Workflow },
  interactive: { icon: SlidersHorizontal },
  examples: { icon: FlaskConical },
  "deep-dive": { icon: Telescope },
  verify: { icon: ShieldCheck },
  quiz: { icon: ListChecks },
  "teach-back": { icon: MessagesSquare },
  voice: { icon: AudioLines },
};

/**
 * Classes for one tab in the "Explanation views" tab list: an underlined tab in
 * a scrolling row on small screens, a highlighted row in the sidebar on large ones.
 */
export function viewTabClass(selected: boolean): string {
  return `flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors lg:rounded-md lg:border-b-0 lg:px-2.5 lg:py-1.5 ${selected
    ? "border-primary font-medium text-foreground lg:bg-muted"
    : "border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-muted/60"}`;
}
