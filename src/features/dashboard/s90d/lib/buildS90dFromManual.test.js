import { describe, expect, it } from "vitest";
import {
  buildDailySummaryFromManual,
  buildGrandTotalSummaryFromManual,
  buildProcessShiftSummaryFromManual,
  buildProductScopedDailySummary,
  buildProductScopedGrandTotalSummary,
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

  it("exposes separate Code D and Code E board rows for S90D processes", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = { okQty: 10, ngQty: 0, defects: {} };
    dayEntry.PRESS.boards[1].shifts["08~10"] = { okQty: 7, ngQty: 1, defects: { scratch: 1 } };
    dayEntry.HAIRLINE.boards[0].shifts["08~10"] = { okQty: 9, ngQty: 1, defects: { scratch: 1 } };
    dayEntry.HAIRLINE.boards[1].shifts["08~10"] = { okQty: 3, ngQty: 2, defects: { scratch: 2 } };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
    });
    const pressDetail = daily.processDetails.find(
      (detail) => detail.process === "PRESS",
    );
    const hairlineDetail = daily.processDetails.find(
      (detail) => detail.process === "HAIRLINE",
    );

    expect(pressDetail?.boardRows).toHaveLength(2);
    expect(pressDetail?.boardRows[0].codeSlot).toBe("D");
    expect(pressDetail?.boardRows[1].codeSlot).toBe("E");
    expect(pressDetail?.boardRows[0].yieldPct).toBe(100);
    expect(pressDetail?.boardRows[1].yieldPct).toBeCloseTo(87.5, 1);
    expect(hairlineDetail?.boardRows[0].yieldPct).toBe(90);
    expect(hairlineDetail?.boardRows[1].yieldPct).toBeCloseTo(68.6, 1);
  });

  it("sets S90D total yield from final ASSEMBLY process row", () => {
    const dayEntry = createEmptyDayEntry();
    dayEntry.PRESS.boards[0].shifts["08~10"] = { okQty: 100, ngQty: 0, defects: {} };
    dayEntry.PRESS.boards[1].shifts["08~10"] = { okQty: 80, ngQty: 20, defects: { scratch: 20 } };
    dayEntry.HAIRLINE.boards[0].shifts["08~10"] = { okQty: 95, ngQty: 5, defects: { scratch: 5 } };
    dayEntry.HAIRLINE.boards[1].shifts["08~10"] = { okQty: 72, ngQty: 8, defects: { scratch: 8 } };
    dayEntry.ANODIZING.boards[0].shifts["08~10"] = { okQty: 90, ngQty: 10, defects: { scratch: 10 } };
    dayEntry.ANODIZING.boards[1].shifts["08~10"] = { okQty: 70, ngQty: 10, defects: { scratch: 10 } };
    dayEntry.ASSEMBLY.boards[0].shifts["08~10"] = { okQty: 88, ngQty: 12, defects: { scratch: 12 } };
    dayEntry.ASSEMBLY.boards[1].shifts["08~10"] = { okQty: 71, ngQty: 9, defects: { scratch: 9 } };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
    });
    const assemblyRow = daily.processRows.find(
      (row) => row.process === "ASSEMBLY",
    );

    expect(assemblyRow?.yieldPct).not.toBeNull();
    expect(daily.totalRow.yieldPct).toBe(assemblyRow?.yieldPct);
    expect(daily.totalRow.yieldPct).not.toBe(daily.totalRow.cumulativeYieldPct);
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

  it("chains AP5 board yields separately per product code", () => {
    const dayEntry = createEmptyDayEntry(AP5_MANUAL_ENTRY_CONFIG);
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 100,
      ngQty: 0,
      defects: {},
    };
    dayEntry.PRESS.boards[1].shifts["08~10"] = {
      okQty: 80,
      ngQty: 20,
      defects: { scratch: 20 },
    };
    dayEntry.MC.boards[0].shifts["08~10"] = {
      okQty: 95,
      ngQty: 5,
      defects: { scratch: 5 },
    };
    dayEntry.MC.boards[1].shifts["08~10"] = {
      okQty: 72,
      ngQty: 8,
      defects: { scratch: 8 },
    };
    dayEntry.HAIRLINE.boards[0].shifts["08~10"] = {
      okQty: 90,
      ngQty: 10,
      defects: { scratch: 10 },
    };
    dayEntry.HAIRLINE.boards[1].shifts["08~10"] = {
      okQty: 60,
      ngQty: 20,
      defects: { scratch: 20 },
    };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
      manualEntryConfig: AP5_MANUAL_ENTRY_CONFIG,
    });

    const pressDetail = daily.processDetails.find(
      (detail) => detail.process === "PRESS",
    );
    const hairlineDetail = daily.processDetails.find(
      (detail) => detail.process === "HAIRLINE",
    );
    const pressFf = pressDetail?.boardRows.find(
      (row) => row.productCode === "AP5FF",
    );
    const pressFz = pressDetail?.boardRows.find(
      (row) => row.productCode === "AP5FZ",
    );
    const hairlineFf = hairlineDetail?.boardRows.find(
      (row) => row.productCode === "AP5FF",
    );
    const hairlineFz = hairlineDetail?.boardRows.find(
      (row) => row.productCode === "AP5FZ",
    );

    expect(pressFf?.yieldPct).toBe(100);
    expect(pressFz?.yieldPct).toBe(80);
    expect(hairlineFf?.yieldPct).toBeCloseTo(94.7, 1);
    expect(hairlineFz?.yieldPct).toBeCloseTo(75, 1);
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

  it("scopes AP5 daily summary to a single product code", () => {
    const dayEntry = createEmptyDayEntry(AP5_MANUAL_ENTRY_CONFIG);
    dayEntry.PRESS.boards[0].shifts["08~10"] = {
      okQty: 100,
      ngQty: 0,
      defects: {},
    };
    dayEntry.PRESS.boards[1].shifts["08~10"] = {
      okQty: 80,
      ngQty: 20,
      defects: { scratch: 20 },
    };
    dayEntry.ASSEMBLY.boards[0].shifts["08~10"] = {
      okQty: 95,
      ngQty: 5,
      defects: { scratch: 5 },
    };
    dayEntry.ASSEMBLY.boards[1].shifts["08~10"] = {
      okQty: 70,
      ngQty: 10,
      defects: { scratch: 10 },
    };

    const daily = buildDailySummaryFromManual({
      dayEntry,
      dateKey: "2026-07-01",
      manualEntryConfig: AP5_MANUAL_ENTRY_CONFIG,
    });

    const scopedFf = buildProductScopedDailySummary(
      daily,
      "AP5FF",
      AP5_MANUAL_ENTRY_CONFIG,
    );
    const scopedFz = buildProductScopedDailySummary(
      daily,
      "AP5FZ",
      AP5_MANUAL_ENTRY_CONFIG,
    );

    expect(scopedFf.productCode).toBe("AP5FF");
    expect(scopedFf.totalRow.totalQty).toBe(100);
    expect(scopedFf.totalRow.okQty).toBe(95);
    expect(scopedFz.productCode).toBe("AP5FZ");
    expect(scopedFz.totalRow.totalQty).toBe(80);
    expect(scopedFz.totalRow.okQty).toBe(70);
    expect(
      scopedFf.processDetails.every((detail) => detail.boardRows.length === 0),
    ).toBe(true);

    const grandFf = buildProductScopedGrandTotalSummary(
      [daily],
      "AP5FF",
      AP5_MANUAL_ENTRY_CONFIG,
    );
    expect(grandFf.productCode).toBe("AP5FF");
    expect(grandFf.totalRow.okQty).toBe(95);
  });
});

