import { ogCard } from "@/components/brand/og-card";

export const alt = "CLEAR. AI knows the answer. CLEAR helps you understand it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard(size);
}
