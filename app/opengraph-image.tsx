import { ImageResponse } from "next/og";

export const alt = "CLEAR. AI knows the answer. CLEAR helps you understand it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VIEWS = ["Understand", "Mental model", "Examples", "Quiz", "Teach it back"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#121713", color: "#edf0e7" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, letterSpacing: 8, color: "#7fd0c8" }}>CLEAR</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, lineHeight: 1.05, letterSpacing: -3 }}>Understand anything.</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#a8b5a7" }}>AI knows the answer. CLEAR helps you understand it.</div>
        </div>
        <div style={{ display: "flex" }}>
          {VIEWS.map((view) => (
            <div key={view} style={{ display: "flex", marginRight: 16, padding: "12px 24px", border: "2px solid #303e33", borderRadius: 999, fontSize: 26, color: "#edf0e7" }}>{view}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
