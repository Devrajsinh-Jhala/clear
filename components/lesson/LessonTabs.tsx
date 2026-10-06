"use client";

import { useRef, useSyncExternalStore } from "react";

import { VIEW_META, viewTabClass } from "@/components/lesson/view-meta";

const sidebarQuery = "(min-width: 1024px)";
function subscribeSidebar(notify: () => void) {
  const query = window.matchMedia(sidebarQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/**
 * The lesson's view tabs. They sit in the sidebar as a vertical list on large
 * screens and scroll as a row above the lesson on small ones. Either pair of
 * arrow keys moves between tabs; Home and End jump to the ends.
 */
export function LessonTabs<T extends string>({ tabs, active, onChange, idPrefix = "" }: {
  tabs: readonly (readonly [T, string])[];
  active: T;
  onChange: (id: T) => void;
  idPrefix?: string;
}) {
  const vertical = useSyncExternalStore(subscribeSidebar, () => window.matchMedia(sidebarQuery).matches, () => false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div
      role="tablist"
      aria-label="Explanation views"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className="-mx-4 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:px-0"
    >
      {tabs.map(([id, label], index) => {
        const selected = active === id;
        const Icon = VIEW_META[id].icon;
        return (
          <button
            key={id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}tab-${id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}panel-${id}`}
            tabIndex={selected ? 0 : -1}
            className={`-mb-px lg:mb-0 ${viewTabClass(selected)}`}
            onClick={() => onChange(id)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index - 1 + tabs.length) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              onChange(tabs[next][0]);
              buttons.current[next]?.focus();
            }}
          >
            <Icon className={`size-4 shrink-0 ${selected ? "text-primary" : ""}`} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
