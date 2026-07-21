import { describe, expect, it } from "vitest";
import { buildS90dProcessShiftSummary } from "./buildS90dProcessShiftSummary";

describe("buildS90dProcessShiftSummary", () => {
  it("aggregates shift rows for one process on one day", () => {
    const barData = {
      PRESS: {
        "10_2026": {
          Normal: {
            "2026-03-01": {
              Day: { Total_Good: 5, Total_NG: 1 },
              "08~10": { Total_Good: 3, Total_NG: 0 },
            },
          },
        },
      },
    };

    const summary = buildS90dProcessShiftSummary({
      process: "PRESS",
      barData,
      ngData: {},
      dateKey: "2026-03-01",
      dateLabel: "03월 01일",
    });

    expect(summary.shiftRows.find((r) => r.shiftSlot === "08~10")?.okQty).toBe(
      8,
    );
    expect(summary.totalRow.okQty).toBe(8);
    expect(summary.percentRow).toBeTruthy();
  });
});
