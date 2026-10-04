import { describe, expect, it } from "vitest";

import { ClearError } from "@/src/lib/api/errors";
import { redactSecrets } from "@/src/lib/ai/redact";
import { getProvider } from "@/src/lib/ai/router";

describe("providers", () => {
  it("returns the mock provider and hides secrets in errors", () => {
    expect(getProvider("mock").id).toBe("mock");
    expect(redactSecrets("failed with sk-abcdefghijklmnopqrstuvwxyz")).toContain("[redacted]");
    expect(() => getProvider("missing")).toThrow(ClearError);
  });
});
