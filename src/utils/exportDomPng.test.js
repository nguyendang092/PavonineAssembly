import { describe, expect, it } from "vitest";
import { fitExportPixelRatio } from "./exportDomPng";

describe("fitExportPixelRatio", () => {
  it("keeps the requested ratio when the canvas fits", () => {
    expect(fitExportPixelRatio(800, 600, 2, 8192)).toBe(2);
  });

  it("lowers the ratio so a tall capture stays inside the canvas limit", () => {
    const ratio = fitExportPixelRatio(1200, 20000, 2, 8192);
    expect(ratio).toBeCloseTo(8192 / 20000, 6);
    expect(ratio).toBeLessThan(1);
  });
});
