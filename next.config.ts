import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/skills/export": ["./skills/clear-explainer/**/*.md"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
