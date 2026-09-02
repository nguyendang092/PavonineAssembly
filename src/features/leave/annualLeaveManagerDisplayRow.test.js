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

  it("uses stored Firebase row values", () => {
    const row = buildAnnualLeaveManagerDisplayRow({
      entry,
      year: 2026,
      monthValues: [1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(2);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).toBe(10);
    expect(row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]).toBeUndefined();
  });
});
