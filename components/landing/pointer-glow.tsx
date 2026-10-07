"use client";

import { useRef, type ReactNode } from "react";

/**
 * Publishes the pointer position to CSS as --mx and --my on its own element, so
 * `.dot-spot` and `.glow-lines` inside it can light up near the pointer. No state,
 * no re-render: one style write per animation frame.
 */
export function PointerGlow({ children, className }: { children: ReactNode; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function place(x: number, y: number) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const node = element.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${x - box.left}px`);
      node.style.setProperty("--my", `${y - box.top}px`);
    });
  }

  function clear() {
    cancelAnimationFrame(frame.current);
    element.current?.style.removeProperty("--mx");
    element.current?.style.removeProperty("--my");
  }

  return (
    <div
      ref={element}
      className={className}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") place(event.clientX, event.clientY);
      }}
      onPointerLeave={clear}
    >
      {children}
    </div>
  );
}
