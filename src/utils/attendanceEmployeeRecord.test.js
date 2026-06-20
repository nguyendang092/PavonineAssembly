import { describe, expect, it } from "vitest";
import {
  attendanceFirebaseKeyFromMnv,
  attendanceMnvStorageKey,
  buildEmployeeAttendanceDayDocument,
  formSliceForAttendanceDayDocument,
  mergeAttendanceDayNodeForPersist,
  resolveAttendanceFormPersistTarget,
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
});

describe("attendanceFirebaseKeyFromMnv", () => {
  it("builds emp_ key from normalized mnv", () => {
    expect(attendanceFirebaseKeyFromMnv("PAVO 1")).toBe("emp_PAVO1");
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

function simulateFormSave({ existingRaw, form, isSeasonal = true, recordId = "emp_1" }) {
  const dayDoc = buildEmployeeAttendanceDayDocument({
    form: formSliceForAttendanceDayDocument(form, {
      businessId: form.mnv,
      loaiPhep: form.loaiPhep ?? "",
      ...(isSeasonal ? { sttThoiVu: form.stt } : {}),
    }),
    existing: existingRaw,
    isSeasonal,
  });
  return mergeAttendanceDayNodeForPersist(existingRaw, dayDoc, recordId);
}

describe("buildEmployeeAttendanceDayDocument loaiPhep (form save)", () => {
  const baseForm = {
    mnv: "1",
    stt: "5",
    hoVaTen: "Test",
    boPhan: "A",
    gioVao: "",
    gioRa: "",
    loaiPhep: "Phép năm",
    caLamViec: "S1",
  };

  it("persists new loaiPhep when Firebase still has gioVao clock on form", () => {
    const saved = simulateFormSave({
      existingRaw: { mnv: "1", gioVao: "08:00", loaiPhep: "" },
      form: { ...baseForm, gioVao: "08:00", loaiPhep: "Phép năm" },
    });
    expect(saved.loaiPhep).toBe("Phép năm");
    expect(saved.gioVao).toBe("");
  });

  it("changes loaiPhep KP → PO on seasonal row", () => {
    const saved = simulateFormSave({
      existingRaw: { mnv: "1", loaiPhep: "Không phép", gioVao: "" },
      form: { ...baseForm, loaiPhep: "Phép ốm" },
    });
    expect(saved.loaiPhep).toBe("Phép ốm");
  });

  it("clears loaiPhep when user selects empty option", () => {
    const saved = simulateFormSave({
      existingRaw: { mnv: "1", loaiPhep: "Phép năm", gioVao: "" },
      form: { ...baseForm, loaiPhep: "" },
    });
    expect(saved.loaiPhep).toBe("");
  });

  it("keeps Vào trễ (VT) with gioVao and gioRa", () => {
    const saved = simulateFormSave({
      existingRaw: { mnv: "1", loaiPhep: "", gioVao: "" },
      form: {
        ...baseForm,
        loaiPhep: "Vào trễ",
        gioVao: "08:15",
        gioRa: "17:30",
      },
    });
    expect(saved.loaiPhep).toBe("Vào trễ");
    expect(saved.gioVao).toBe("08:15");
    expect(saved.gioRa).toBe("17:30");
  });

  it("keeps VT alias with clock times", () => {
    const saved = simulateFormSave({
      existingRaw: { mnv: "1" },
      form: {
        ...baseForm,
        loaiPhep: "VT",
        gioVao: "08:20",
        gioRa: "17:00",
      },
    });
    expect(saved.loaiPhep).toBe("Vào trễ");
    expect(saved.gioVao).toBe("08:20");
    expect(saved.gioRa).toBe("17:00");
  });
});
