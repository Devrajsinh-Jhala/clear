import { describe, expect, it } from "vitest";

import { assertUpload, parsePageSelection } from "@/src/lib/uploads/files";

describe("uploads", () => {
  it("accepts a matching image", () => {
    expect(assertUpload({ mimeType: "image/png", sizeBytes: 1200, filename: "diagram.png" })).toBe("image/png");
  });

  it("rejects a mismatched extension", () => {
    expect(() => assertUpload({ mimeType: "application/pdf", sizeBytes: 1200, filename: "notes.png" })).toThrow(
      /extension/i,
    );
  });

  it("reads a page selection", () => {
    expect(parsePageSelection("1-3, 5", 8)).toEqual([1, 2, 3, 5]);
  });

  it("rejects a page past the end", () => {
    expect(() => parsePageSelection("1-9", 4)).toThrow(/outside/i);
  });
});
