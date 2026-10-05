import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Reporter } from "@playwright/test/reporter";

export default class CleanupReporter implements Reporter {
  async onExit() {
    const directory = process.env.CLEAR_E2E_DATA_DIR;
    if (!directory) return;
    const resolved = path.resolve(directory);
    // Reporter exit follows CLI teardown, including stopping the production server.
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("clear-e2e-")) {
      throw new Error("Refusing to remove an unexpected browser-test data directory.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
}
