import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  computeLiveAnnualLeaveState,
  resolveHrAnnualLeaveUsed,
  buildLiveAnnualLeaveBalanceByMnv,
} from "./annualLeaveDerived";

describe("annualLeaveDerived", () => {
  it("balance = total − live PN (3 days) for emp 251205 scenario", () => {
    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1.5,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1.5,
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
    };
    const state = computeLiveAnnualLeaveState(raw, 3);
    expect(state.hrUsed).toBe(0);
    expect(state.attendanceUsed).toBe(3);
    expect(state.balance).toBe(1.5);
  });

  it("does not treat stale annualLeaveUsed as HR when no split fields", () => {
    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1.5,
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
    };
    expect(resolveHrAnnualLeaveUsed(raw)).toBe(0);
    const state = computeLiveAnnualLeaveState(raw, 0);
    expect(state.balance).toBe(4.5);
  });

  it("keeps explicit HR used separate from attendance", () => {
    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "Y",
    };
    const state = computeLiveAnnualLeaveState(raw, 3);
    expect(state.hrUsed).toBe(2);
    expect(state.used).toBe(5);
    expect(state.balance).toBe(7);
  });

  it("resolveHr uses stored attendance split when HR field missing", () => {
    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 5,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 2,
    };
    expect(resolveHrAnnualLeaveUsed(raw)).toBe(3);
  });

  it("buildLiveAnnualLeaveBalanceByMnv maps mnv prefix", () => {
    const map = buildLiveAnnualLeaveBalanceByMnv(
      {
        emp_ABC: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "ABC",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 0,
        },
      },
      { emp_ABC: 2 },
    );
    expect(map.emp_ABC).toBe(8);
  });
});
