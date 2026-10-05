import { lstat, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Reporter } from "@playwright/test/reporter";

export default class AuthFixtureCleanup implements Reporter {
  async onExit() {
    const fixture = path.resolve(process.env.CLEAR_AUTH_UI_DIRECTORY ?? "");
    if (path.dirname(fixture) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith("clear-auth-ui-")) throw new Error("Unexpected auth UI fixture directory.");
    const dependencies = path.join(fixture, "node_modules");
    const link = await lstat(dependencies).catch(() => null);
    if (link) {
      if (!link.isSymbolicLink()) throw new Error("Auth fixture dependencies must remain a link; refusing recursive cleanup.");
      // Remove only the junction itself before deleting the fixture directory.
      await unlink(dependencies);
    }
    await rm(fixture, { recursive: true, force: true });
  }
}
