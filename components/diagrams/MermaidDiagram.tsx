"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

// Mermaid needs hex colours. These follow the violet tokens in globals.css.
const LIGHT = {
  background: "#fafafd",
  primaryColor: "#efecfd",
  primaryBorderColor: "#8e7ff2",
  primaryTextColor: "#1f1b2e",
  secondaryColor: "#fcecf5",
  secondaryBorderColor: "#e08ab8",
  tertiaryColor: "#f6f5fb",
  tertiaryBorderColor: "#d9d5e8",
  lineColor: "#6d6787",
  textColor: "#1f1b2e",
  noteBkgColor: "#fff4e0",
  noteBorderColor: "#e3b866",
  noteTextColor: "#3d2e10",
  actorLineColor: "#b9b3d1",
  labelBoxBkgColor: "#efecfd",
  labelBoxBorderColor: "#8e7ff2",
  edgeLabelBackground: "#fafafd",
};

const DARK = {
  background: "#0b0b15",
  primaryColor: "#2c2650",
  primaryBorderColor: "#8b7cf6",
  primaryTextColor: "#ece9f8",
  secondaryColor: "#3b2441",
  secondaryBorderColor: "#c77aa6",
  tertiaryColor: "#221e33",
  tertiaryBorderColor: "#3d3856",
  lineColor: "#a29cbe",
  textColor: "#ece9f8",
  noteBkgColor: "#3a2f1c",
  noteBorderColor: "#b18d4c",
  noteTextColor: "#f5ead2",
  actorLineColor: "#4a4466",
  labelBoxBkgColor: "#2c2650",
  labelBoxBorderColor: "#8b7cf6",
  edgeLabelBackground: "#0b0b15",
};

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
        theme: "base",
        darkMode: resolvedTheme === "dark",
        themeVariables: resolvedTheme === "dark" ? DARK : LIGHT,
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
      className="mt-5 overflow-x-auto rounded-xl border border-border bg-background p-4 [&_svg]:mx-auto"
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
