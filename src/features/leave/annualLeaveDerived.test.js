import { describe, expect, it, vi, afterEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  computeLiveAnnualLeaveState,
  mergeStoredAndAttendanceMonthlyUsage,
  resolveAnnualLeaveMonthUsageValue,
  resolveHrAnnualLeaveUsed,
  buildLiveAnnualLeaveBalanceByMnv,
  normalizeAnnualLeaveRowLive,
  sumAnnualLeaveMonthlyUsageValues,
} from "./annualLeaveDerived";

describe("annualLeaveDerived", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("balance = total − live PN (3 days) for emp 251205 scenario", () => {
    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1.5,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1.5,
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
    };
    const state = computeLiveAnnualLeaveState(raw, 3, 2026);
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

  it("sumAnnualLeaveMonthlyUsageValues totals month columns", () => {
    expect(sumAnnualLeaveMonthlyUsageValues([1, 0, 0.5, 0])).toBe(1.5);
    expect(sumAnnualLeaveMonthlyUsageValues([])).toBeNull();
  });

  it("resolveAnnualLeaveMonthUsageValue uses display-only pn counts", () => {
    expect(
      resolveAnnualLeaveMonthUsageValue({
        displayOnly: true,
        totalDeduction: 0,
        pnCount: 1,
        halfPnCount: 0,
      }),
    ).toBe(1);
  });

  it("buildAnnualLeaveMonthlyUsageByEmpKey maps 12 months from attendance", () => {
    const { yearMonths, monthlyByEmpKey } = buildAnnualLeaveMonthlyUsageByEmpKey(
      2026,
      {},
      {
        emp_X: [0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 0, 0],
      },
    );
    expect(yearMonths).toHaveLength(12);
    expect(monthlyByEmpKey.emp_X[5]).toBe(1);
    expect(monthlyByEmpKey.emp_X[6]).toBe(0.5);
    expect(monthlyByEmpKey.emp_X[0]).toBe(0);
  });

  it("keeps stored Jan-May and attendance from June", () => {
    const { monthlyByEmpKey } = buildAnnualLeaveMonthlyUsageByEmpKey(
      2026,
      {
        emp_X: [1, 0.5, 0, 0, 0, 99, 99, 0, 0, 0, 0, 0],
      },
      {
        emp_X: [0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 0, 0],
      },
    );
    expect(monthlyByEmpKey.emp_X[0]).toBe(1);
    expect(monthlyByEmpKey.emp_X[1]).toBe(0.5);
    expect(monthlyByEmpKey.emp_X[4]).toBe(0);
    expect(monthlyByEmpKey.emp_X[5]).toBe(1);
    expect(monthlyByEmpKey.emp_X[6]).toBe(0.5);
  });

  it("mergeStoredAndAttendanceMonthlyUsage splits at June", () => {
    const merged = mergeStoredAndAttendanceMonthlyUsage(
      [2, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 0, 0],
    );
    expect(merged[0]).toBe(2);
    expect(merged[4]).toBe(0);
    expect(merged[5]).toBe(1);
    expect(merged[6]).toBe(0.5);
  });

  it("uses monthly column sum for annual leave used in row normalize", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-10",
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
    };
    const monthValues = [0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 0, 0];
    const row = normalizeAnnualLeaveRowLive(
      "emp_X",
      raw,
      { emp_X: 99 },
      2026,
      monthValues,
    );
    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(1.5);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).toBe(7.5);
  });

  it("applies monthly accrual and tenure in row normalize", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const raw = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-10",
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 0,
    };
    const row = normalizeAnnualLeaveRowLive(
      "emp_X",
      raw,
      {},
      2026,
      Array(12).fill(0),
    );
    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]).toBe(9);
    expect(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(0);
    expect(row[ANNUAL_LEAVE_EMP.BALANCE]).toBe(9);
  });
});
