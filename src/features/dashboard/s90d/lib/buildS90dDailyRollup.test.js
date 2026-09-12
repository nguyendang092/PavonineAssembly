import { describe, expect, it } from "vitest";
import { mergeMonthDailySummariesForRollup } from "./buildS90dDailyRollup";

describe("mergeMonthDailySummariesForRollup", () => {
  it("sums Deco 65 and 55 totals for the same day", () => {
    const merged = mergeMonthDailySummariesForRollup([
      [
        {
          dateKey: "2026-09-01",
          hasData: true,
          totalRow: { totalQty: 10, ngQty: 1 },
          processRows: [{ process: "PRESS", totalQty: 10, ngQty: 1 }],
        },
      ],
      [
        {
          dateKey: "2026-09-01",
          hasData: true,
          totalRow: { totalQty: 5, ngQty: 2 },
          processRows: [{ process: "PRESS", totalQty: 5, ngQty: 2 }],
        },
      ],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      dateKey: "2026-09-01",
      hasData: true,
      totalRow: { totalQty: 15, ngQty: 3 },
    });
    expect(merged[0].processRows[0]).toMatchObject({
      process: "PRESS",
      totalQty: 15,
      ngQty: 3,
    });
  });
});
