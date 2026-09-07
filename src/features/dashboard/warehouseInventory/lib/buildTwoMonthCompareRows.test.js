import { describe, expect, it } from "vitest";
import { buildTwoMonthCompareRows } from "./buildTwoMonthCompareRows";

const baseRow = (overrides = {}) => ({
  whCode: "WH01",
  warehouseName: "Kho A",
  whFilterKey: "WH01",
  category: "원자재",
  code: "C001",
  month: "01-2026",
  monthKey: "2026-01",
  item: "Item A",
  status: "OK",
  reason: "—",
  unit: "EA",
  actualQty: 10,
  sysQty: 8,
  amountActual: 1000,
  gapAmount: 200,
  monthlyDiff: 2,
  ...overrides,
});

describe("buildTwoMonthCompareRows", () => {
  it("returns delta for matching codes in both months", () => {
    const rows = buildTwoMonthCompareRows(
      [
        baseRow({ monthKey: "2026-01", month: "01-2026", actualQty: 10, sysQty: 8, amountActual: 1000, gapAmount: 200 }),
        baseRow({ monthKey: "2026-02", month: "02-2026", actualQty: 15, sysQty: 9, amountActual: 1500, gapAmount: 300 }),
      ],
      "2026-01",
      "2026-02",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].actualQty).toBe(5);
    expect(rows[0].sysQty).toBe(1);
    expect(rows[0].amountActual).toBe(500);
    expect(rows[0].gapAmount).toBe(100);
    expect(rows[0].month).toBe("01-2026 → 02-2026");
    expect(rows[0].isMonthCompareRow).toBe(true);
  });

  it("skips codes missing in either month", () => {
    const rows = buildTwoMonthCompareRows(
      [
        baseRow({ code: "C001", monthKey: "2026-01" }),
        baseRow({ code: "C002", monthKey: "2026-02" }),
      ],
      "2026-01",
      "2026-02",
    );
    expect(rows).toHaveLength(0);
  });

  it("auto orders earlier/later when months picked in reverse", () => {
    const rows = buildTwoMonthCompareRows(
      [
        baseRow({ monthKey: "2026-01", actualQty: 4 }),
        baseRow({ monthKey: "2026-03", actualQty: 10 }),
      ],
      "2026-03",
      "2026-01",
    );
    expect(rows[0].actualQty).toBe(6);
  });
});
