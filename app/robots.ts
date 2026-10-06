import type { MetadataRoute } from "next";

// Lessons, shared snapshots and account pages are private or unlisted by design.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/learn/", "/shared/", "/library", "/settings", "/progress", "/auth"] } };
}
