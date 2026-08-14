import { describe, expect, it } from "vitest";
import {
  buildDailySummaryFromManual,
  buildGrandTotalSummaryFromManual,
  buildProcessShiftSummaryFromManual,
} from "./buildS90dFromManual";
import { AP5_MANUAL_ENTRY_CONFIG } from "./s90dManualEntryReportConfig";
import { createEmptyDayEntry } from "./s90dManualEntries";

describe("buildS90dFromManual", () => {
  it("builds process shift summary from manual entries", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].productCode = "S90D-A";
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 100,
      ngQty: 2,
      defects: { scratch: 1, dent: 1 },
    };

    const summary = buildProcessShiftSummaryFromManual({
      boardEntry: dayEntry.PRESS.boards[0],
      process: "PRESS",
      dateLabel: "07월 01일",
    });

    expect(summary.shiftRows[0].totalQty).toBe(102);
    expect(summary.shiftRows[0].ngQty).toBe(2);
    expect(summary.shiftRows[0].productCode).toBe("S90D-A");
    expect(summary.totalRow.totalQty).toBe(102);
    expect(summary.totalRow.okQty).toBe(100);
  });

  it("aggregates daily summary from all processes", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = { okQty: 10, ngQty: 0, defects: {} };
    dayEntry.HAIRLINE.boards[0].shifts["08~10"] = {
      okQty: 8,
      ngQty: 2,
      defects: { scratch: 2 },
    };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
    });

    expect(daily.processRows[0].okQty).toBe(10);
    expect(daily.processRows[1].okQty).toBe(8);
    expect(daily.totalRow.totalQty).toBe(20);
    expect(daily.totalRow.okQty).toBe(18);
    expect(daily.totalRow.ngQty).toBe(2);
  });

  it("aggregates multiple boards on the same day for one process", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = { okQty: 10, ngQty: 0, defects: {} };
    dayEntry.PRESS.boards.push({
      ...dayEntry.PRESS.boards[0],
      id: "board-2",
      label: "Bảng 2",
      shifts: {
        ...dayEntry.PRESS.boards[0].shifts,
        "10~12": { okQty: 5, ngQty: 0, defects: {} },
      },
    });
    dayEntry.PRESS.boards[1].shifts = Object.fromEntries(
      Object.keys(dayEntry.PRESS.boards[0].shifts).map((slot) => [
        slot,
        slot === "10~12"
          ? { okQty: 5, ngQty: 0, defects: {} }
          : { okQty: 0, ngQty: 0, defects: {} },
      ]),
    );

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
    });

    expect(daily.processRows[0].okQty).toBe(15);
    expect(daily.processRows[0].totalQty).toBe(15);
  });

  it("aggregates grand total from daily summaries", () => {
    const dayOne = createEmptyDayEntry();
    dayOne.PRESS.boards[0].shifts["08~10"] = { okQty: 5, ngQty: 0, defects: {} };

    const dayTwo = createEmptyDayEntry();
    dayTwo.PRESS.boards[0].shifts["08~10"] = {
      okQty: 3,
      ngQty: 1,
      defects: { scratch: 1 },
    };

    const dailySummaries = [
      buildDailySummaryFromManual({ dayEntry: dayOne, dateKey: "2026-07-01" }),
      buildDailySummaryFromManual({ dayEntry: dayTwo, dateKey: "2026-07-02" }),
    ];

    const grand = buildGrandTotalSummaryFromManual(dailySummaries);

    expect(grand.processRows[0].okQty).toBe(8);
    expect(grand.processRows[0].ngQty).toBe(1);
    expect(grand.totalRow.totalQty).toBe(9);
    expect(grand.totalRow.okQty).toBe(8);
    expect(grand.totalRow.ngQty).toBe(1);
  });

  it("derives ngQty from defect counts per shift", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 50,
      ngQty: 99,
      defects: { scratch: 2, dent: 3, burr: 1 },
    };

    const summary = buildProcessShiftSummaryFromManual({
      boardEntry: dayEntry.PRESS.boards[0],
      process: "PRESS",
    });

    expect(summary.shiftRows[0].ngQty).toBe(6);
    expect(summary.shiftRows[0].totalQty).toBe(56);
    expect(summary.totalRow.ngQty).toBe(6);
    expect(summary.totalRow.totalQty).toBe(56);
  });

  it("uses assembly output for AP5 total row when full process chain has data", () => {
    const dayEntry = createEmptyDayEntry(AP5_MANUAL_ENTRY_CONFIG);
    const processes = ["PRESS", "MC", "HAIRLINE", "ANODIZING", "ASSEMBLY"];

    processes.forEach((process) => {
      dayEntry[process].boards[0].shifts["08~10"] = {
        okQty: process === "ASSEMBLY" ? 95 : 100,
        ngQty: process === "ASSEMBLY" ? 5 : 0,
        defects: process === "ASSEMBLY" ? { scratch: 5 } : {},
      };
    });

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
      manualEntryConfig: AP5_MANUAL_ENTRY_CONFIG,
    });

    const assemblyRow = daily.processRows.find(
      (row) => row.process === "ASSEMBLY",
    );

    expect(assemblyRow?.totalQty).toBe(100);
    expect(assemblyRow?.okQty).toBe(95);
    expect(assemblyRow?.yieldPct).toBe(95);
    expect(daily.totalRow.totalQty).toBe(100);
    expect(daily.totalRow.okQty).toBe(95);
    expect(daily.totalRow.yieldPct).toBe(95);
    expect(daily.totalRow.ngRatePct).toBe(5);
  });

  it("invalidates AP5 yield when MC has no quantity", () => {
    const dayEntry = createEmptyDayEntry(AP5_MANUAL_ENTRY_CONFIG);
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 100,
      ngQty: 0,
      defects: {},
    };
    dayEntry.ASSEMBLY.boards[0].shifts["08~10"] = {
      okQty: 95,
      ngQty: 5,
      defects: { scratch: 5 },
    };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
      manualEntryConfig: AP5_MANUAL_ENTRY_CONFIG,
    });

    const mcRow = daily.processRows.find((row) => row.process === "MC");
    const assemblyRow = daily.processRows.find(
      (row) => row.process === "ASSEMBLY",
    );

    expect(mcRow?.totalQty).toBe(0);
    expect(mcRow?.yieldPct).toBeNull();
    expect(assemblyRow?.yieldPct).toBeNull();
    expect(daily.totalRow.yieldPct).toBeNull();
    expect(daily.totalRow.ngRatePct).toBeNull();
  });

  it("aggregates defect images into daily and grand totals", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 10,
      ngQty: 1,
      defects: { scratch: 1 },
      defectImages: { scratch: "https://i.ibb.co/test1.jpg" },
    };
    dayEntry.HAIRLINE.boards[0].shifts["08~10"] = {
      okQty: 8,
      ngQty: 0,
      defects: {},
      defectImages: { dent: "https://i.ibb.co/test2.jpg" },
    };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
    });

    expect(daily.totalRow.defectImages.scratch).toEqual([
      "https://i.ibb.co/test1.jpg",
    ]);
    expect(daily.totalRow.defectImages.dent).toEqual([
      "https://i.ibb.co/test2.jpg",
    ]);

    const grand = buildGrandTotalSummaryFromManual([daily]);
    expect(grand.totalRow.defectImages.scratch).toEqual([
      "https://i.ibb.co/test1.jpg",
    ]);
  });
});

