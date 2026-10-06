import { ImageResponse } from "next/og";

const VIEWS = ["Understand", "Mental model", "Examples", "Quiz", "Teach it back"];

/** The 1200×630 share card used for Open Graph and Twitter previews. */
export function ogCard(size: { width: number; height: number }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0c0c0e", color: "#f0f0f2" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ marginRight: 14 }}>
            <path d="M2 18.5h9" stroke="#f0f0f2" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
            <path d="M19.5 14 30 8.5" stroke="#929bf5" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M20.5 17.5H30" stroke="#929bf5" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
            <path d="m19.5 21 10.5 5.5" stroke="#929bf5" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
            <path d="M15.2 5.6a1.6 1.6 0 0 1 2.8 0l8.3 15.2a1.6 1.6 0 0 1-1.4 2.4H8.3a1.6 1.6 0 0 1-1.4-2.4L15.2 5.6Z" fill="#0c0c0e" stroke="#f0f0f2" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          CLEAR
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 600, lineHeight: 1.02, letterSpacing: -4 }}>Understand anything.</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#a1a1a8" }}>AI knows the answer. CLEAR helps you understand it.</div>
        </div>
        <div style={{ display: "flex" }}>
          {VIEWS.map((view) => (
            <div key={view} style={{ display: "flex", marginRight: 14, padding: "10px 20px", border: "2px solid #27272b", borderRadius: 10, fontSize: 26, color: "#f0f0f2" }}>{view}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
