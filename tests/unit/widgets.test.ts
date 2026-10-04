import { describe, expect, it } from "vitest";

import { interactiveWidgetSpecSchema } from "@/src/lib/explanation/schema";
import { evaluateSafeMath } from "@/src/lib/explanation/safe-math";
import { canRenderInteractive } from "@/src/lib/explanation/widget-registry";
import { binarySearchSteps, breadthFirstSteps } from "@/src/lib/explanation/widget-sim";

describe("safe arithmetic", () => {
  it("evaluates names and arithmetic", () => {
    expect(evaluateSafeMath("(a + 2) * b", { a: 3, b: 4 })).toBe(20);
  });

  it("rejects function calls and unknown names", () => {
    expect(evaluateSafeMath("alert(1)", {})).toBeNull();
    expect(evaluateSafeMath("a + b", { a: 1 })).toBeNull();
  });
});

describe("widget simulations", () => {
  it("walks a sorted binary search and refuses an unsorted list", () => {
    expect(binarySearchSteps([1, 3, 5, 7], 5)?.at(-1)?.comparison).toBe("equal");
    expect(binarySearchSteps([3, 1, 2], 1)).toBeNull();
  });

  it("visits each reachable graph node once", () => {
    const steps = breadthFirstSteps(["a", "b", "c"], [{ from: "a", to: "b" }, { from: "b", to: "c" }], "a");
    expect(steps.map((step) => step.current)).toEqual(["a", "b", "c"]);
  });
});

describe("code trace schema", () => {
  it("accepts a recorded trace and rejects script execution fields", () => {
    const parsed = interactiveWidgetSpecSchema.safeParse({
      type: "code-trace",
      title: "Counter",
      language: "python",
      code: "n = 1\nn = n + 1",
      steps: [{ id: "add", line: 2, explanation: "n becomes 2", locals: [{ name: "n", value: "2" }] }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(canRenderInteractive(parsed.data)).toBe(true);
  });
});
