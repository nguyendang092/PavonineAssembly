import { describe, expect, it, vi, afterEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  buildAnnualLeaveExcelHeaderRow1,
  buildAnnualLeaveExcelHeaderRow2,
  buildAnnualLeaveExcelMonthColumnLabels,
} from "./annualLeaveExcelTemplate";
import {
  findAnnualLeaveHeaderLayout,
  parseAnnualLeaveExcelFile,
  resolveImportedAnnualLeaveBase,
} from "./annualLeaveExcelImport";

describe("annualLeaveExcelTemplate", () => {
  it("builds 23-column header with 12 months and ADJUST", () => {
    const row1 = buildAnnualLeaveExcelHeaderRow1(2026);
    const row2 = buildAnnualLeaveExcelHeaderRow2(2026);
    expect(row1).toHaveLength(23);
    expect(row1[10]).toBe("Jan-26");
    expect(row1[21]).toBe("Dec-26");
    expect(row1[22]).toBe("ADJUST");
    expect(row2[1]).toBe("MNV");
    expect(row2[2]).toBe("MVT");
    expect(buildAnnualLeaveExcelMonthColumnLabels(2026)).toHaveLength(12);
  });
});

describe("findAnnualLeaveHeaderLayout", () => {
  it("detects 2-row header and month columns after balance", () => {
    const rows = [
      buildAnnualLeaveExcelHeaderRow1(2026),
      buildAnnualLeaveExcelHeaderRow2(2026),
      [
        1,
        "251205",
        "A",
        "Nguyen Van A",
        "1-Jan-90",
        "PRESS",
        "1-Jan-20",
        12,
        2,
        10,
        1,
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "",
      ],
    ];
    const layout = findAnnualLeaveHeaderLayout(rows, 2026);
    expect(layout?.dataStartRow).toBe(2);
    expect(layout?.col.mnvPrefix).toBe(1);
    expect(layout?.col.annualLeave).toBe(7);
    expect(layout?.col.used).toBe(8);
    expect(layout?.col.balance).toBe(9);
    expect(layout?.col.monthIndices).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });
});

describe("resolveImportedAnnualLeaveBase", () => {
  it("parses numeric base leave", () => {
    expect(resolveImportedAnnualLeaveBase("12")).toBe(12);
    expect(resolveImportedAnnualLeaveBase("")).toBe(0);
  });
});

describe("parseAnnualLeaveExcelFile", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses new template rows from sheet json", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const rows = [
      buildAnnualLeaveExcelHeaderRow1(2026),
      buildAnnualLeaveExcelHeaderRow2(2026),
      [
        1,
        "251205",
        "",
        "Test User",
        "",
        "ASSEMBLY",
        "2016-01-10",
        12,
        1,
        11,
        ...Array(12).fill("-"),
      ],
    ];

    const XLSX = await import("@e965/xlsx");
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Annual Leave 2026");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "annual-leave-2026.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const { records, errors } = await parseAnnualLeaveExcelFile(file, {
      year: 2026,
    });
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0][ANNUAL_LEAVE_EMP.MNV_PREFIX]).toBe("251205");
    expect(records[0][ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]).toBe(7);
    expect(records[0][ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]).toBe(0);
    expect(records[0][ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]).toBe(0);
    expect(records[0][ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(0);
    expect(records[0][ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]).toBe(0);
    expect(records[0][ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(7);
    expect(records[0][ANNUAL_LEAVE_EMP.BALANCE]).toBe(7);
  });

  it("derives current year, used and balance from month columns when summary cells are empty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const monthCells = Array(12).fill("-");
    monthCells[0] = 1;
    monthCells[1] = 0.5;

    const rows = [
      buildAnnualLeaveExcelHeaderRow1(2026),
      buildAnnualLeaveExcelHeaderRow2(2026),
      [
        1,
        "251205",
        "",
        "Test User",
        "",
        "ASSEMBLY",
        "2016-01-10",
        "",
        "",
        "",
        ...monthCells,
      ],
    ];

    const XLSX = await import("@e965/xlsx");
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Annual Leave 2026");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "annual-leave-2026.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const { records, errors } = await parseAnnualLeaveExcelFile(file, {
      year: 2026,
    });
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0][ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]).toEqual([
      1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(records[0][ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]).toBe(7);
    expect(records[0][ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(1.5);
    expect(records[0][ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(7);
    expect(records[0][ANNUAL_LEAVE_EMP.BALANCE]).toBe(5.5);
  });
});
