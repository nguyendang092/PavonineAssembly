import { describe, expect, it } from "vitest";
import {
  dayNormalTotal,
  dayOkNormalOnly,
  dayOkSplit,
  dayReworkOnly,
} from "./dayTotals";

describe("dayOkSplit", () => {
  it("sums day and night for non-CNC areas", () => {
    const dayArr = [
      {
        Day: { normal: 10, rework: 2 },
        Night: { normal: 5, rework: 1 },
      },
    ];
    expect(dayOkSplit("PRESS", dayArr, 0)).toEqual({ normal: 15, rework: 3 });
    expect(dayOkNormalOnly("PRESS", dayArr, 0)).toBe(15);
    expect(dayReworkOnly("PRESS", dayArr, 0)).toBe(3);
    expect(dayNormalTotal("PRESS", dayArr, 0)).toBe(18);
  });

  it("uses next night shift for CNC", () => {
    const dayArr = [
      {
        Day: { normal: 4, rework: 1 },
        Night: { normal: 99, rework: 99 },
      },
      {
        Day: { normal: 0, rework: 0 },
        Night: { normal: 3, rework: 2 },
      },
    ];
    expect(dayOkSplit("CNC", dayArr, 0)).toEqual({ normal: 7, rework: 3 });
  });
});
