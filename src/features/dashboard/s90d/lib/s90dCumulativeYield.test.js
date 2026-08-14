import { describe, expect, it } from "vitest";
import {
  applyS90dCumulativeYieldPct,
  computeS90dCumulativeYieldPct,
} from "./s90dCumulativeYield";

describe("s90dCumulativeYield", () => {
  it("computes cumulative yield from previous stage cumulative ratio", () => {
    expect(computeS90dCumulativeYieldPct(100, null, 0)).toBe(100);
    expect(computeS90dCumulativeYieldPct(90, 100, 1)).toBe(90);
    expect(computeS90dCumulativeYieldPct(88, 94.7, 2)).toBe(92.9);
    expect(computeS90dCumulativeYieldPct(91, 92.9, 3)).toBe(98);
  });

  it("applies cumulative yield to process rows", () => {
    const processRows = [
      { process: "PRESS", yieldPct: 95, totalQty: 100 },
      { process: "HAIRLINE", yieldPct: 90, totalQty: 100 },
      { process: "ANODIZING", yieldPct: 88, totalQty: 100 },
      { process: "ASSEMBLY", yieldPct: 91, totalQty: 100 },
    ];

    applyS90dCumulativeYieldPct(processRows);

    expect(processRows[0].cumulativeYieldPct).toBe(95);
    expect(processRows[1].cumulativeYieldPct).toBe(94.7);
    expect(processRows[2].cumulativeYieldPct).toBe(92.9);
    expect(processRows[3].cumulativeYieldPct).toBe(98);
  });

  it("uses null for empty daily rows when requested", () => {
    const processRows = [
      { process: "PRESS", yieldPct: 0, totalQty: 0 },
      { process: "HAIRLINE", yieldPct: 80, totalQty: 10 },
    ];

    applyS90dCumulativeYieldPct(processRows, { emptyAsNull: true });

    expect(processRows[0].cumulativeYieldPct).toBeNull();
    expect(processRows[1].cumulativeYieldPct).toBeNull();
  });
});
