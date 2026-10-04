import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { isUuid } from "@/src/lib/explanation/normalize";
import type { ExplanationDocument } from "@/src/lib/explanation/schema";
import {
  defaultRoutingPreferences,
  isRouteProvider,
  ROUTING_TASKS,
  type RoutingPreferences,
  type RoutingTaskId,
} from "@/src/lib/routing/choose";

export type CompareRating = "clearer" | "more-accurate" | "prefer";

export type CompareOption = {
  id: string;
  provider: string;
  model: string;
  document: ExplanationDocument | null;
  error?: string;
  ratings: CompareRating[];
};

export type LessonMeta = {
  fallbackNote?: string;
  comparison?: {
    pickedId?: string;
    options: CompareOption[];
  };
};

const routingRoot = path.join(process.cwd(), ".data", "routing");
const metaRoot = path.join(process.cwd(), ".data", "lesson-meta");

export async function readRoutingPreferences(learnerId: string | undefined): Promise<RoutingPreferences> {
  const fallback = defaultRoutingPreferences();
  if (!learnerId || !isUuid(learnerId)) return fallback;
  try {
    const parsed = JSON.parse(await readFile(path.join(routingRoot, `${learnerId}.json`), "utf8")) as RoutingPreferences;
    return normalizePreferences(parsed);
  } catch {
    return fallback;
  }
}

export async function writeRoutingPreferences(learnerId: string, preferences: RoutingPreferences): Promise<void> {
  if (!isUuid(learnerId)) throw new Error("Refusing to store routing preferences with an invalid id.");
  await mkdir(routingRoot, { recursive: true });
  const destination = path.join(routingRoot, `${learnerId}.json`);
  const temporary = path.join(routingRoot, `${learnerId}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(normalizePreferences(preferences)), "utf8");
  await rename(temporary, destination);
}

export async function readLessonMeta(conversationId: string): Promise<LessonMeta> {
  if (!isUuid(conversationId)) return {};
  try {
    const parsed = JSON.parse(await readFile(path.join(metaRoot, `${conversationId}.json`), "utf8")) as LessonMeta;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeLessonMeta(conversationId: string, meta: LessonMeta): Promise<void> {
  if (!isUuid(conversationId)) throw new Error("Refusing to store lesson routing with an invalid id.");
  await mkdir(metaRoot, { recursive: true });
  const destination = path.join(metaRoot, `${conversationId}.json`);
  const temporary = path.join(metaRoot, `${conversationId}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(meta), "utf8");
  await rename(temporary, destination);
}

function normalizePreferences(value: RoutingPreferences): RoutingPreferences {
  const fallback = defaultRoutingPreferences();
  const tasks: RoutingPreferences["tasks"] = {};
  for (const task of ROUTING_TASKS) {
    const target = value.tasks?.[task.id];
    if (target && isRouteProvider(target.provider) && typeof target.model === "string") {
      tasks[task.id] = { provider: target.provider, model: target.model.trim() };
    }
  }
  const provider = isRouteProvider(value.defaultTarget?.provider) ? value.defaultTarget.provider : fallback.defaultTarget.provider;
  return {
    auto: value.auto === true,
    fallbackAllowed: value.fallbackAllowed === true,
    defaultTarget: {
      provider,
      model: typeof value.defaultTarget?.model === "string" ? value.defaultTarget.model.trim() : "",
    },
    tasks,
  };
}

export function isRoutingTask(value: string): value is RoutingTaskId {
  return ROUTING_TASKS.some((task) => task.id === value);
}
