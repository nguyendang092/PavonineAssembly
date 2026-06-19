import { describe, expect, it } from "vitest";
import { PAYROLL_EMP } from "./payrollEmployeeFields";
import {
  buildPayrollMonthDayCellFormRecord,
  parsePayrollDayFromAttendanceRaw,
  pickPayrollMonthRepProfileFields,
} from "./buildPayrollDayFromRaw";

describe("buildPayrollMonthDayCellFormRecord", () => {
  const rep = {
    monthEmployeeKey: "NV001",
    hoVaTen: "Rep Name",
    mnv: "NV001",
    boPhan: "SX",
    gioVao: "06:00",
    gioRa: "17:00",
    loaiPhep: "PN",
  };

  const chunk = {
    baseEmployees: [
      {
        id: "firebase-key-1",
        mnv: "NV001",
        hoVaTen: "Day Name",
        boPhan: "SX",
        gioVao: "06:00",
        gioRa: "18:00",
        loaiPhep: "",
        caLamViec: "S1",
        boPhanChuaDung: "",
        gioiTinh: "NO",
      },
    ],
    earlyOtPaperworkById: { "firebase-key-1": true },
    lateOtExcludedById: { "firebase-key-1": false },
  };

  const dayEmp = {
    id: "firebase-key-1",
    monthEmployeeKey: "NV001",
    mnv: "NV001",
    gioVao: "06:00",
    gioRa: "18:00",
    loaiPhep: "",
    caLamViec: "S1",
  };

  it("uses day attendance from baseEmployees, not rep first-day snapshot", () => {
    const record = buildPayrollMonthDayCellFormRecord({
      chunk,
      rowId: "NV001",
      rep,
      dayEmp,
    });
    expect(record.id).toBe("firebase-key-1");
    expect(record.gioVao).toBe("06:00");
    expect(record.gioRa).toBe("18:00");
    expect(record.loaiPhep).toBe("");
    expect(record.caLamViec).toBe("S1");
    expect(record.gioiTinh).toBe("NO");
    expect(record.boPhanChuaDung).toBe("");
    expect(record.payrollEarlyOtPaperwork).toBe(true);
    expect(record.payrollLateOtExcluded).toBe(false);
  });

  it("clears day fields when adding new attendance for the day", () => {
    const record = buildPayrollMonthDayCellFormRecord({
      chunk,
      rowId: "NV001",
      rep,
      dayEmp: null,
    });
    expect(record.id).toBe("");
    expect(record.gioVao).toBe("");
    expect(record.gioRa).toBe("");
    expect(record.loaiPhep).toBe("");
    expect(record.mnv).toBe("NV001");
    expect(record.hoVaTen).toBe("Rep Name");
    expect(record.boPhan).toBe("SX");
  });
});

describe("pickPayrollMonthRepProfileFields", () => {
  it("does not copy attendance fields from rep", () => {
    const profile = pickPayrollMonthRepProfileFields({
      mnv: "A",
      hoVaTen: "A",
      gioVao: "06:00",
      loaiPhep: "PN",
    });
    expect(profile.mnv).toBe("A");
    expect(profile.hoVaTen).toBe("A");
    expect(profile.gioVao).toBeUndefined();
    expect(profile.loaiPhep).toBeUndefined();
  });
});

describe("parsePayrollDayFromAttendanceRaw — TC sớm ca đêm", () => {
  it("bỏ cờ earlyOt trên S2 dù _meta có true", () => {
    const raw = {
      _meta: { earlyOtPaperwork: { "night-1": true } },
      "night-1": {
        mnv: "NV002",
        gioVao: "06:00",
        gioRa: "06:30",
        caLamViec: "S2",
        stt: 1,
      },
    };
    const parsed = parsePayrollDayFromAttendanceRaw(raw);
    expect(parsed.earlyOtPaperworkById).toEqual({});
    expect(
      parsed.payrollEmployees[0][PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK],
    ).toBeUndefined();
  });
});
