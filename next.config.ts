import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { proxyClientMaxBodySize: process.env.VERCEL === "1" ? "4mb" : "32mb" },
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./.env*", "./.git/**/*", "./.vercel/**/*", "./tests/**/*", "./evals/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/skills/export": ["./skills/clear-explainer/**/*.md"],
    "/api/explanations/*/export": ["./src/lib/export/fonts/*"],
    "/api/shared/*/export": ["./src/lib/export/fonts/*"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
