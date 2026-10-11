import { describe, expect, it } from "vitest";
import { dayNGTotal, dayNormalTotal, formatDayLabelShort } from "./dayTotals";

describe("dayTotals", () => {
  it("sums day and night OK for non-CNC areas", () => {
    const dayArr = [
      {
        Day: { normal: 10, rework: 2 },
        Night: { normal: 5, rework: 1 },
      },
    ];
    expect(dayNormalTotal("PRESS", dayArr, 0)).toBe(18);
  });

  it("uses only the day shift for CNC OK total", () => {
    const dayArr = [
      {
        Day: { normal: 4, rework: 1 },
        Night: { normal: 99, rework: 99 },
      },
    ];
    expect(dayNormalTotal("CNC", dayArr, 0)).toBe(5);
  });

  it("sums NG the same way as OK (CNC = day only)", () => {
    const dayArr = [
      {
        Day: { ng_normal: 2, ng_rework: 1 },
        Night: { ng_normal: 8, ng_rework: 8 },
      },
    ];
    expect(dayNGTotal("PRESS", dayArr, 0)).toBe(19);
    expect(dayNGTotal("CNC", dayArr, 0)).toBe(3);
  });

  it("formats ISO dates as dd/MM", () => {
    expect(formatDayLabelShort("2026-10-09")).toBe("09/10");
  });
});
