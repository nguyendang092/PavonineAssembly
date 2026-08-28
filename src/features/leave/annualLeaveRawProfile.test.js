import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  buildAttendanceProfileByEmpKey,
  mergeAnnualLeaveProfileFields,
  normalizeAnnualLeaveRawProfile,
  resolveAnnualLeaveRawWithProfiles,
} from "./annualLeaveRawProfile";

describe("annualLeaveRawProfile", () => {
  it("maps legacy attendance/payroll fields and emp key fallback", () => {
    const raw = normalizeAnnualLeaveRawProfile(
      {
        mnv: "251205",
        mvt: "01",
        hoVaTen: "Nguyen Van A",
        boPhan: "PRESS",
        ngayVaoLam: "2020-01-10",
      },
      "emp_251205",
    );

    expect(raw[ANNUAL_LEAVE_EMP.MNV_PREFIX]).toBe("251205");
    expect(raw[ANNUAL_LEAVE_EMP.MNV_SUFFIX]).toBe("01");
    expect(raw[ANNUAL_LEAVE_EMP.FULL_NAME]).toBe("Nguyen Van A");
    expect(raw[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]).toBe("PRESS");
    expect(raw[ANNUAL_LEAVE_EMP.START_WORKING_DATE]).toBe("2020-01-10");
  });

  it("derives MNV from emp_{mnv} when profile fields are missing", () => {
    const raw = normalizeAnnualLeaveRawProfile(
      {
        rowNo: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 3,
      },
      "emp_260638",
    );

    expect(raw[ANNUAL_LEAVE_EMP.MNV_PREFIX]).toBe("260638");
  });

  it("mergeAnnualLeaveProfileFields keeps the first non-empty value", () => {
    expect(
      mergeAnnualLeaveProfileFields(
        { [ANNUAL_LEAVE_EMP.FULL_NAME]: "A" },
        { [ANNUAL_LEAVE_EMP.FULL_NAME]: "B" },
      )[ANNUAL_LEAVE_EMP.FULL_NAME],
    ).toBe("A");
    expect(
      mergeAnnualLeaveProfileFields(
        {},
        { hoVaTen: "From attendance" },
      )[ANNUAL_LEAVE_EMP.FULL_NAME],
    ).toBe("From attendance");
  });

  it("buildAttendanceProfileByEmpKey scans attendance root", () => {
    const map = buildAttendanceProfileByEmpKey({
      "2026-06-01": {
        emp_100: { mnv: "100", hoVaTen: "Tran A", boPhan: "ASSEMBLY" },
      },
      "2026-06-02": {
        emp_100: { mnv: "100", hoVaTen: "Tran A Updated", boPhan: "ASSEMBLY" },
      },
    });

    expect(map.emp_100[ANNUAL_LEAVE_EMP.MNV_PREFIX]).toBe("100");
    expect(map.emp_100[ANNUAL_LEAVE_EMP.FULL_NAME]).toBe("Tran A");
    expect(map.emp_100[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]).toBe("ASSEMBLY");
  });

  it("buildAttendanceProfileByEmpKey respects scope and skips complete profiles", () => {
    const map = buildAttendanceProfileByEmpKey(
      {
        "2026-06-01": {
          emp_100: { mnv: "100", hoVaTen: "Tran A" },
          emp_200: { mnv: "200", hoVaTen: "Tran B" },
        },
      },
      new Set(["emp_200"]),
    );

    expect(map.emp_100).toBeUndefined();
    expect(map.emp_200[ANNUAL_LEAVE_EMP.FULL_NAME]).toBe("Tran B");
  });

  it("resolveAnnualLeaveRawWithProfiles merges attendance fallback", () => {
    const raw = resolveAnnualLeaveRawWithProfiles(
      { [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 3 },
      "emp_100",
      {
        emp_100: { hoVaTen: "Tran A", boPhan: "ASSEMBLY" },
      },
    );

    expect(raw[ANNUAL_LEAVE_EMP.MNV_PREFIX]).toBe("100");
    expect(raw[ANNUAL_LEAVE_EMP.FULL_NAME]).toBe("Tran A");
    expect(raw[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]).toBe("ASSEMBLY");
  });
});
