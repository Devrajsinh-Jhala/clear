"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

// Mermaid needs hex colours. These follow the indigo and grey tokens in globals.css.
const LIGHT = {
  background: "#fcfdfe",
  primaryColor: "#eef0fd",
  primaryBorderColor: "#7c83e0",
  primaryTextColor: "#18181e",
  secondaryColor: "#f3f3f6",
  secondaryBorderColor: "#c9c9d1",
  tertiaryColor: "#f7f7f9",
  tertiaryBorderColor: "#e2e2e5",
  lineColor: "#62626b",
  textColor: "#18181e",
  noteBkgColor: "#fdf6e7",
  noteBorderColor: "#d9b76a",
  noteTextColor: "#3d2e10",
  actorLineColor: "#c9c9d1",
  labelBoxBkgColor: "#eef0fd",
  labelBoxBorderColor: "#7c83e0",
  edgeLabelBackground: "#fcfdfe",
};

const DARK = {
  background: "#0c0c0e",
  primaryColor: "#202235",
  primaryBorderColor: "#7f88e8",
  primaryTextColor: "#f0f0f2",
  secondaryColor: "#1b1b1e",
  secondaryBorderColor: "#3a3a40",
  tertiaryColor: "#131316",
  tertiaryBorderColor: "#27272b",
  lineColor: "#a1a1a8",
  textColor: "#f0f0f2",
  noteBkgColor: "#2e2718",
  noteBorderColor: "#a8884a",
  noteTextColor: "#f5ead2",
  actorLineColor: "#3a3a40",
  labelBoxBkgColor: "#202235",
  labelBoxBorderColor: "#7f88e8",
  edgeLabelBackground: "#0c0c0e",
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
