import { ClearError } from "@/src/lib/api/errors";
import { isByokProvider, type ByokProviderId } from "@/src/lib/ai/byok";

export const ROUTING_TASKS = [
  { id: "everyday", label: "Everyday explanations" },
  { id: "coding", label: "Coding" },
  { id: "research", label: "Research documents" },
  { id: "math", label: "Math" },
] as const;

export type RoutingTaskId = (typeof ROUTING_TASKS)[number]["id"];

export type RouteProviderId = "clear-free" | ByokProviderId;

export type RouteTarget = {
  provider: RouteProviderId;
  model: string;
};

export type RoutingPreferences = {
  auto: boolean;
  fallbackAllowed: boolean;
  defaultTarget: RouteTarget;
  tasks: Partial<Record<RoutingTaskId, RouteTarget>>;
};

export type ApprovedTarget = RouteTarget & {
  label: string;
  pdf: boolean;
  vision: boolean;
};

export type RouteDecision = {
  provider: RouteProviderId;
  model: string;
  reason: string;
  fallback: boolean;
};

const FALLBACK_CODES = new Set([
  "provider_not_configured",
  "provider_key_invalid",
  "provider_quota",
  "provider_error",
  "provider_timeout",
  "provider_unreachable",
  "unsupported_attachment",
]);

export function defaultRoutingPreferences(model = "gemini-3.5-flash-lite"): RoutingPreferences {
  return {
    auto: false,
    fallbackAllowed: false,
    defaultTarget: { provider: "clear-free", model },
    tasks: {},
  };
}

export function isRouteProvider(value: string): value is RouteProviderId {
  return value === "clear-free" || isByokProvider(value);
}

export function classifyTask(input: {
  question: string;
  hasPdf: boolean;
  sourceLength: number;
}): RoutingTaskId {
  if (input.hasPdf || input.sourceLength > 8000) return "research";
  const text = input.question.toLowerCase();
  if (/\b(paper|citation|study|research|literature|journal)\b/.test(text)) return "research";
  if (/\b(integral|equation|proof|theorem|algebra|calculus|matrix|probability|derivative)\b/.test(text)) return "math";
  if (/\b(function|algorithm|bug|compile|python|typescript|javascript|regex|refactor)\b|```/.test(text)) return "coding";
  return "everyday";
}

export function chooseRoute(input: {
  question: string;
  sourceLength: number;
  hasPdf: boolean;
  hasImage: boolean;
  preferences: RoutingPreferences;
  available: ApprovedTarget[];
  explicit?: RouteTarget;
  forceAuto?: boolean;
}): RouteDecision {
  const available = input.available.filter((target) => supports(target, input));
  if (input.explicit) {
    const chosen = findTarget(available, input.explicit);
    if (chosen) return decision(chosen, input.explicit.model, "explicit", false);
    return fallbackOrStop(input, available, `${labelOf(input.explicit.provider)} is not available for this request.`);
  }

  const task = classifyTask(input);
  const taskTarget = input.preferences.tasks[task];
  if (taskTarget) {
    const chosen = findTarget(available, taskTarget);
    if (chosen) return decision(chosen, taskTarget.model, `task:${task}`, false);
  }

  const auto = input.forceAuto || input.preferences.auto;
  if (auto) {
    const autoTarget = autoPick(task, input, available);
    if (autoTarget) return decision(autoTarget, "", `auto:${task}`, false);
  }

  const fallbackTarget = findTarget(available, input.preferences.defaultTarget);
  if (fallbackTarget) return decision(fallbackTarget, input.preferences.defaultTarget.model, "default", false);
  return fallbackOrStop(input, available, "The default provider is not available for this request.");
}

export function shouldUseClearFreeFallback(input: {
  error: unknown;
  provider: string;
  alreadyFellBack: boolean;
  fallbackAllowed: boolean;
  clearFreeAvailable: boolean;
}): boolean {
  if (!input.fallbackAllowed || !input.clearFreeAvailable || input.alreadyFellBack) return false;
  if (input.provider === "clear-free") return false;
  return input.error instanceof ClearError && FALLBACK_CODES.has(input.error.code);
}

function autoPick(task: RoutingTaskId, input: { hasPdf: boolean; hasImage: boolean }, available: ApprovedTarget[]): ApprovedTarget | undefined {
  if (input.hasPdf) return findProvider(available, "clear-free") ?? findProvider(available, "gemini");
  if (input.hasImage) return available.find((target) => target.vision);
  if (task === "coding") return findProvider(available, "openai") ?? findProvider(available, "clear-free");
  if (task === "research") return findProvider(available, "anthropic") ?? findProvider(available, "clear-free");
  if (task === "math") return findProvider(available, "clear-free") ?? available[0];
  return findProvider(available, "clear-free") ?? available[0];
}

function fallbackOrStop(input: { preferences: RoutingPreferences; available: ApprovedTarget[] }, capable: ApprovedTarget[], why: string): RouteDecision {
  const clearFree = input.preferences.fallbackAllowed ? findProvider(capable, "clear-free") : undefined;
  if (clearFree) return decision(clearFree, "", "fallback", true);
  const suffix = input.preferences.fallbackAllowed
    ? "CLEAR did not switch to another provider."
    : "Fallback is off, so CLEAR did not switch providers.";
  throw new ClearError("provider_not_configured", `${why} ${suffix}`, { status: 400 });
}

function decision(target: ApprovedTarget, requestedModel: string, reason: string, fallback: boolean): RouteDecision {
  return {
    provider: target.provider,
    model: requestedModel.trim() || target.model,
    reason,
    fallback,
  };
}

function findTarget(available: ApprovedTarget[], target: RouteTarget): ApprovedTarget | undefined {
  return available.find((item) => item.provider === target.provider);
}

function findProvider(available: ApprovedTarget[], provider: RouteProviderId): ApprovedTarget | undefined {
  return available.find((item) => item.provider === provider);
}

function supports(target: ApprovedTarget, input: { hasPdf: boolean; hasImage: boolean }): boolean {
  if (input.hasPdf && !target.pdf) return false;
  if (input.hasImage && !target.vision) return false;
  return true;
}

function labelOf(provider: string): string {
  if (provider === "clear-free") return "CLEAR Free";
  return provider;
}
