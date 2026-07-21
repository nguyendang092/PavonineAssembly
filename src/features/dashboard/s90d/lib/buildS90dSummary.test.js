import { describe, expect, it } from "vitest";
import { buildS90dSummary } from "./buildS90dSummary";

describe("buildS90dSummary", () => {
  it("aggregates bar rows by process and computes cumulative yield", () => {
    const barData = {
      PRESS: {
        "10_2026": {
          Normal: {
            "2026-03-01": {
              Day: { Total_Good: 100, Total_NG: 0 },
            },
          },
        },
      },
      HAIRLINE: {
        "10_2026": {
          Normal: {
            "2026-03-01": {
              Day: { Total_Good: 90, Total_NG: 10 },
            },
          },
        },
      },
    };

    const summary = buildS90dSummary({
      barData,
      ngData: {},
      weekKey: "10_2026",
    });

    expect(summary.processRows[0].okQty).toBe(100);
    expect(summary.processRows[0].yieldPct).toBe(100);
    expect(summary.processRows[1].okQty).toBe(90);
    expect(summary.processRows[1].ngQty).toBe(10);
    expect(summary.processRows[1].cumulativeYieldPct).toBe(90);
    expect(summary.totalRow.okQty).toBe(190);
    expect(summary.totalRow.ngQty).toBe(10);
  });

  it("maps ng reasons to defect columns", () => {
    const ngData = {
      ASSEMBLY: {
        "10_2026": {
          Normal: {
            "2026-03-01": {
              MODEL1: { Day: { quantity: 5, reason: "스크래치" } },
            },
          },
        },
      },
    };

    const summary = buildS90dSummary({
      barData: {},
      ngData,
      weekKey: "10_2026",
    });

    expect(summary.totalRow.defects.scratch).toBe(5);
    expect(summary.percentRow.defects.scratch).toBe(0);
  });
});
