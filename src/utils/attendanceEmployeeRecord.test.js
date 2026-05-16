import { describe, expect, it } from "vitest";
import {
  attendanceFirebaseKeyFromMnv,
  attendanceMnvStorageKey,
  canonicalAttendanceMnvForMatch,
  resolveAttendanceFormPersistTarget,
  resolveExcelBusinessId,
} from "./attendanceEmployeeRecord";

describe("attendanceMnvStorageKey", () => {
  it("trims and removes internal whitespace", () => {
    expect(attendanceMnvStorageKey("  PAVO 123  ")).toBe("PAVO123");
    expect(attendanceMnvStorageKey("12 34")).toBe("1234");
  });

  it("keeps letters and does not coerce to number", () => {
    expect(attendanceMnvStorageKey("00123")).toBe("00123");
    expect(attendanceMnvStorageKey(123)).toBe("123");
    expect(attendanceMnvStorageKey("PAVO")).toBe("PAVO");
  });

  it("returns empty for missing values", () => {
    expect(attendanceMnvStorageKey("")).toBe("");
    expect(attendanceMnvStorageKey(null)).toBe("");
  });

  it("matches canonicalAttendanceMnvForMatch", () => {
    expect(canonicalAttendanceMnvForMatch(" A B ")).toBe("AB");
  });
});

describe("attendanceFirebaseKeyFromMnv", () => {
  it("builds emp_ key from normalized mnv", () => {
    expect(attendanceFirebaseKeyFromMnv("PAVO 1")).toBe("emp_PAVO1");
  });
});

describe("resolveExcelBusinessId", () => {
  it("prefers id cell then mnv, then normalizes", () => {
    expect(resolveExcelBusinessId(" P 1 ", "ignored")).toBe("P1");
    expect(resolveExcelBusinessId("", " MNV 2 ")).toBe("MNV2");
  });
});

describe("resolveAttendanceFormPersistTarget", () => {
  it("edit mode keeps existing Firebase key", () => {
    expect(
      resolveAttendanceFormPersistTarget({
        editAttendanceKey: "-OxOld",
        storageKey: "999",
      }),
    ).toEqual({
      firebaseKey: "-OxOld",
      recordId: "-OxOld",
      mode: "edit",
    });
  });

  it("add-create uses emp_{mnv} when node empty", () => {
    expect(
      resolveAttendanceFormPersistTarget({
        storageKey: "PAVO 1",
        existingRaw: {},
      }),
    ).toEqual({
      firebaseKey: "emp_PAVO1",
      recordId: "emp_PAVO1",
      mode: "add-create",
    });
  });

  it("add-merge when same key already has mnv", () => {
    expect(
      resolveAttendanceFormPersistTarget({
        storageKey: "123",
        existingRaw: { mnv: "123", hoVaTen: "A" },
      }),
    ).toEqual({
      firebaseKey: "emp_123",
      recordId: "emp_123",
      mode: "add-merge",
    });
  });

  it("returns null for empty storage key", () => {
    expect(
      resolveAttendanceFormPersistTarget({ storageKey: "   " }),
    ).toBeNull();
  });
});
