import { describe, expect, it } from "vitest";
import {
  formatPctChange,
  formatSignedKRW,
  formatSignedQty,
  signedDeltaClass,
} from "./formatDelta";

describe("formatDelta", () => {
  it("signs qty and percent", () => {
    expect(formatSignedQty(12.5)).toMatch(/^\+/);
    expect(formatSignedQty(-3)).toMatch(/^−3/);
    expect(formatSignedQty(0)).toBe("0");
    expect(formatPctChange(10, 5)).toBe("+50%");
    expect(formatPctChange(10, -2.5)).toBe("−25%");
    expect(formatPctChange(0, 5)).toBe("");
  });

  it("marks up/down classes", () => {
    expect(signedDeltaClass(2)).toContain("up");
    expect(signedDeltaClass(-1)).toContain("down");
    expect(signedDeltaClass(0)).toContain("flat");
  });

  it("signs KRW", () => {
    expect(formatSignedKRW(1500)).toMatch(/^\+/);
    expect(formatSignedKRW(-200)).toMatch(/^−/);
  });
});
