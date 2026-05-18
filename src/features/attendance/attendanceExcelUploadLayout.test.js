import { describe, expect, it } from "vitest";
import {
  findAttendanceExcelLayout,
  normalizeHeaderCell,
} from "./attendanceExcelUploadLayout";

describe("findAttendanceExcelLayout", () => {
  it("detects standard STT + MNV header", () => {
    const rows = [
      ["STT", "MNV", "MVT"],
      ["No.", "Employee ID", "Badge"],
      [1, 100, "A"],
    ];
    expect(findAttendanceExcelLayout(rows)).toEqual({
      dataRowStart: 2,
      mnvCol: 1,
    });
  });

  it("detects date column before MNV", () => {
    const rows = [
      ["STT", "Ngày", "MNV"],
      ["No.", "Date", "Employee ID"],
      [1, "2025-01-01", 200],
    ];
    expect(findAttendanceExcelLayout(rows)).toEqual({
      dataRowStart: 2,
      mnvCol: 2,
    });
  });

  it("falls back when headers not recognized", () => {
    expect(findAttendanceExcelLayout([["A"], ["B"], [1]])).toEqual({
      dataRowStart: 2,
      mnvCol: 1,
    });
  });
});

describe("normalizeHeaderCell", () => {
  it("trims and lowercases for header matching", () => {
    expect(normalizeHeaderCell("  Ngày HĐ  ")).toBe("ngày hđ");
    expect(normalizeHeaderCell("Mã NV")).toBe("mã nv");
  });
});
