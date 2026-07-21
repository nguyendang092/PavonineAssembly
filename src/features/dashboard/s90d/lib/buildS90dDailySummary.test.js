import { describe, expect, it } from "vitest";
import {
  formatS90dMonthDisplayLabel,
  listCurrentMonthDateKeys,
  listMonthDateKeys,
  listMonthKeysFromStore,
} from "./s90dDateUtils";
import {
  buildS90dDailySummary,
} from "./buildS90dDailySummary";
describe("buildS90dDailySummary", () => {
  it("aggregates one day by process with defects and percent row", () => {
    const barData = {
      PRESS: {
        "10_2026": {
          Normal: {
            "2026-03-01": { Day: { Total_Good: 10, Total_NG: 0 } },
          },
        },
      },
      HAIRLINE: {
        "10_2026": {
          Normal: {
            "2026-03-01": { Day: { Total_Good: 8, Total_NG: 2 } },
          },
        },
      },
    };

    const ngData = {
      ASSEMBLY: {
        "10_2026": {
          Normal: {
            "2026-03-01": {
              MODEL1: { Day: { quantity: 2, reason: "스크러치" } },
            },
          },
        },
      },
    };

    const daily = buildS90dDailySummary({
      barData,
      ngData,
      dateKey: "2026-03-01",
    });

    expect(daily.processRows[0].okQty).toBe(10);
    expect(daily.processRows[0].cumulativeYieldPct).toBeNull();
    expect(daily.processRows[1].ngQty).toBe(2);
    expect(daily.totalRow.totalQty).toBe(20);
    expect(daily.percentRow).toBeTruthy();
    expect(daily.processRows[3].defects.scratch).toBe(2);
  });

  it("lists days from start of month through reference date only", () => {
    const keys = listCurrentMonthDateKeys(new Date(2026, 6, 15));
    expect(keys).toHaveLength(15);
    expect(keys[0]).toBe("2026-07-01");
    expect(keys[14]).toBe("2026-07-15");
  });

  it("lists full past month days", () => {
    const keys = listMonthDateKeys("2026-06", new Date(2026, 6, 15));
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-06-01");
    expect(keys[29]).toBe("2026-06-30");
  });

  it("builds month options from stored date keys", () => {
    const options = listMonthKeysFromStore(
      {
        "2026-05-10": {},
        "2026-07-01": {},
      },
      new Date(2026, 6, 8),
    );

    expect(options).toEqual(["2026-07", "2026-05"]);
  });

  it("formats month label for dropdown", () => {
    expect(formatS90dMonthDisplayLabel("2026-07")).toBe("07/2026");
  });
});
