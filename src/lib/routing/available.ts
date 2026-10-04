import "server-only";

import { listPublicCredentials } from "@/src/lib/ai/credential-service";
import { defaultClearFreeModel } from "@/src/lib/ai/models";
import type { ApprovedTarget } from "@/src/lib/routing/choose";

export async function listApprovedTargets(): Promise<ApprovedTarget[]> {
  const targets: ApprovedTarget[] = [];
  if (process.env.CLEAR_PROVIDER === "mock" || process.env.GEMINI_API_KEY) {
    targets.push({
      provider: "clear-free",
      model: defaultClearFreeModel(),
      label: "CLEAR Free",
      pdf: true,
      vision: true,
    });
  }
  const connected = await listPublicCredentials();
  for (const item of connected) {
    targets.push({
      provider: item.id,
      model: item.model,
      label: item.label,
      pdf: item.id === "gemini",
      vision: item.id !== "xai",
    });
  }
  return targets;
}
