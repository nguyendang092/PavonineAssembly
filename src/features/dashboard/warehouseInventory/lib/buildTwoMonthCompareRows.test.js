import { describe, expect, it } from "vitest";
import {
  buildMultiMonthCompareRows,
  buildTwoMonthCompareRows,
} from "./buildTwoMonthCompareRows";

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
        baseRow({ monthKey: "2026-01", month: "01-2026", actualQty: 10, sysQty: 8, amountActual: 1000, amountErp: 1100, gapAmount: 200 }),
        baseRow({ monthKey: "2026-02", month: "02-2026", actualQty: 15, sysQty: 9, amountActual: 1500, amountErp: 1600, gapAmount: 300 }),
      ],
      "2026-01",
      "2026-02",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].actualQty).toBe(5);
    expect(rows[0].actualQtyFrom).toBe(10);
    expect(rows[0].actualQtyTo).toBe(15);
    expect(rows[0].sysQty).toBe(1);
    expect(rows[0].amountActual).toBe(500);
    expect(rows[0].amountActualFrom).toBe(1000);
    expect(rows[0].amountErpFrom).toBe(1100);
    expect(rows[0].amountErpTo).toBe(1600);
    expect(rows[0].amountErp).toBe(500);
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

  it("orders larger quantity swings first", () => {
    const rows = buildTwoMonthCompareRows(
      [
        baseRow({
          code: "SMALL",
          monthKey: "2026-01",
          actualQty: 10,
        }),
        baseRow({
          code: "SMALL",
          monthKey: "2026-02",
          actualQty: 11,
        }),
        baseRow({
          code: "BIG",
          monthKey: "2026-01",
          actualQty: 10,
        }),
        baseRow({
          code: "BIG",
          monthKey: "2026-02",
          actualQty: 40,
        }),
      ],
      "2026-01",
      "2026-02",
    );
    expect(rows.map((r) => r.code)).toEqual(["BIG", "SMALL"]);
  });
});

describe("buildMultiMonthCompareRows", () => {
  it("requires the code in every selected month and deltas last minus first", () => {
    const rows = buildMultiMonthCompareRows(
      [
        baseRow({ monthKey: "2026-01", month: "01-2026", actualQty: 10, amountActual: 100, amountErp: 110 }),
        baseRow({ monthKey: "2026-02", month: "02-2026", actualQty: 12, amountActual: 120, amountErp: 130 }),
        baseRow({ monthKey: "2026-03", month: "03-2026", actualQty: 18, amountActual: 180, amountErp: 190 }),
      ],
      ["2026-03", "2026-01", "2026-02"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].compareMonths).toHaveLength(3);
    expect(rows[0].actualQtyFrom).toBe(10);
    expect(rows[0].actualQtyTo).toBe(18);
    expect(rows[0].actualQty).toBe(8);
    expect(rows[0].amountActual).toBe(80);
  });

  it("drops codes missing a selected month", () => {
    const rows = buildMultiMonthCompareRows(
      [
        baseRow({ monthKey: "2026-01", actualQty: 10 }),
        baseRow({ monthKey: "2026-02", actualQty: 12 }),
      ],
      ["2026-01", "2026-02", "2026-03"],
    );
    expect(rows).toHaveLength(0);
  });
});
