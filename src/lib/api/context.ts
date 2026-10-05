import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { LimitAction } from "@/src/lib/security/limits";

export const requestContext = new AsyncLocalStorage<{ request: Request; action: LimitAction }>();
