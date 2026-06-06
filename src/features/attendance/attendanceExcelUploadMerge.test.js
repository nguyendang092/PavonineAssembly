import { describe, expect, it } from "vitest";
import {
  hasAttendanceExcelCellValue,
  mergeAttendanceExcelIntoExistingRecord,
  mergeAttendanceExcelUploadIntoDaySnapshot,
} from "./attendanceExcelUploadMerge";

describe("mergeAttendanceExcelIntoExistingRecord", () => {
  it("fills empty Firebase fields from Excel, keeps existing values", () => {
    const merged = mergeAttendanceExcelIntoExistingRecord(
      { mnv: "123", hoVaTen: "A", gioVao: "08:00" },
      {
        mnv: "123",
        hoVaTen: "B",
        gioRa: "17:00",
      },
    );
    expect(merged.hoVaTen).toBe("A");
    expect(merged.gioRa).toBe("17:00");
    expect(merged.stt).toBeUndefined();
  });

  it("writes STT when Firebase STT empty and Excel has STT", () => {
    const merged = mergeAttendanceExcelIntoExistingRecord(
      { mnv: "123" },
      { stt: 5, _excelHasStt: true },
    );
    expect(merged.stt).toBe(5);
  });

  it("seasonal: keeps existing sttThoiVu when Firebase already has STT", () => {
    const merged = mergeAttendanceExcelIntoExistingRecord(
      { mnv: "123", sttThoiVu: 99, stt: 55 },
      { stt: 5, _excelHasStt: true },
      { seasonal: true },
    );
    expect(merged.sttThoiVu).toBe(99);
    expect(merged.stt).toBeUndefined();
  });

  it("seasonal: writes sttThoiVu when Firebase STT empty and Excel has STT", () => {
    const merged = mergeAttendanceExcelIntoExistingRecord(
      { mnv: "123" },
      { stt: 5, _excelHasStt: true },
      { seasonal: true },
    );
    expect(merged.sttThoiVu).toBe(5);
    expect(merged.stt).toBeUndefined();
  });

  it("official: keeps existing STT when Firebase already has STT", () => {
    const merged = mergeAttendanceExcelIntoExistingRecord(
      { mnv: "123", stt: 99 },
      { stt: 5, _excelHasStt: true },
      { seasonal: false },
    );
    expect(merged.stt).toBe(99);
  });
});

describe("mergeAttendanceExcelUploadIntoDaySnapshot", () => {
  const row = (mnv, extra = {}) => ({
    id: `emp_${mnv}`,
    mnv,
    hoVaTen: "Test",
    gioiTinh: "YES",
    ...extra,
  });

  it("adds new employee at emp_{mnv}", () => {
    const { mergedData, uploadedCount, duplicateCount } =
      mergeAttendanceExcelUploadIntoDaySnapshot({}, { emp_PAVO1: row("PAVO1") });
    expect(uploadedCount).toBe(1);
    expect(duplicateCount).toBe(0);
    expect(mergedData.emp_PAVO1.mnv).toBe("PAVO1");
    expect(mergedData.emp_PAVO1.id).toBe("emp_PAVO1");
  });

  it("merges duplicate MNV and migrates legacy push key to emp_{mnv}", () => {
    const existing = {
      "-OxLegacyKey": {
        id: "-OxLegacyKey",
        mnv: "123",
        hoVaTen: "Giữ tên",
        gioVao: "08:00",
      },
    };
    const upload = {
      emp_123: {
        id: "emp_123",
        mnv: "123",
        hoVaTen: "Excel",
        gioRa: "17:00",
        gioiTinh: "YES",
      },
    };
    const { mergedData, duplicateCount } =
      mergeAttendanceExcelUploadIntoDaySnapshot(existing, upload);
    expect(duplicateCount).toBe(1);
    expect(mergedData["-OxLegacyKey"]).toBeUndefined();
    expect(mergedData.emp_123.hoVaTen).toBe("Giữ tên");
    expect(mergedData.emp_123.gioRa).toBe("17:00");
    expect(mergedData.emp_123.id).toBe("emp_123");
  });

  it("matches MNV with spaces against stored code", () => {
    const existing = {
      emp_12: { id: "emp_12", mnv: "12", hoVaTen: "X" },
    };
    const upload = {
      emp_12: row("12", { mvt: "MVT-1" }),
    };
    const { mergedData, duplicateCount } =
      mergeAttendanceExcelUploadIntoDaySnapshot(existing, upload);
    expect(duplicateCount).toBe(1);
    expect(mergedData.emp_12.mvt).toBe("MVT-1");
    expect(mergedData.emp_12.hoVaTen).toBe("X");
  });

  it("strips _excel internal fields from payload", () => {
    const { mergedData } = mergeAttendanceExcelUploadIntoDaySnapshot(
      {},
      {
        emp_1: {
          ...row("1"),
          _excelHasStt: true,
        },
      },
    );
    expect(mergedData.emp_1._excelHasStt).toBeUndefined();
    expect(hasAttendanceExcelCellValue(mergedData.emp_1.mnv)).toBe(true);
  });
});
