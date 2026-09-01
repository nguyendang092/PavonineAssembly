import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { buildAnnualLeaveManagerDisplayRow } from "./annualLeaveManagerDisplayRow";

describe("buildAnnualLeaveManagerDisplayRow", () => {
  const entry = {
    id: "emp_100",
    _raw: {
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "100",
      [ANNUAL_LEAVE_EMP.FULL_NAME]: "Test User",
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2020-01-01",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
      [ANNUAL_LEAVE_EMP.BALANCE]: 10,
      [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  };

  it("uses live totals when attendance usage is ready", () => {
    const row = buildAnnualLeaveManagerDisplayRow({
      entry,
      year: 2026,
      monthValues: [1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      attendanceUsageReady: true,
      attendanceAccrualReady: false,
      deductionsByEmpKey: { emp_100: 1.5 },
    });

    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(1.5);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).not.toBe(10);
  });

  it("falls back to stored Firebase row before attendance is ready", () => {
    const row = buildAnnualLeaveManagerDisplayRow({
      entry,
      year: 2026,
      monthValues: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      attendanceUsageReady: false,
    });

    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(2);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).toBe(10);
    expect(row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]).toBeUndefined();
  });

  it("keeps stored Firebase row when preferStoredOnly is set", () => {
    const row = buildAnnualLeaveManagerDisplayRow({
      entry,
      year: 2026,
      monthValues: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      attendanceUsageReady: true,
      preferStoredOnly: true,
      deductionsByEmpKey: { emp_100: 1.5 },
    });

    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(2);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).toBe(10);
  });
});
