"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

export function MermaidDiagram({ source }: { source: string }) {
  const reactId = useId().replace(/:/g, "");
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: resolvedTheme === "dark" ? "dark" : "neutral",
        fontFamily: "inherit",
      });
      const { svg: markup } = await mermaid.render(`clear-diagram-${reactId}`, source);
      if (cancelled) return;
      setFailed(false);
      setSvg(sanitizeSvg(markup));
    };
    render().catch(() => {
      if (cancelled) return;
      setSvg("");
      setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reactId, resolvedTheme, source]);

  if (failed) {
    return <p className="mt-4 text-sm text-muted-foreground">The diagram source could not be drawn. The paragraph above is the explanation.</p>;
  }
  if (!svg) {
    return <p className="mt-4 text-sm text-muted-foreground">Drawing the diagram…</p>;
  }
  return (
    <div
      className="rounded-xl mt-4 overflow-x-auto border border-border bg-background p-4"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function sanitizeSvg(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, "");
}
