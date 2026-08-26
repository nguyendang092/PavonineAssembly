import { afterEach, describe, expect, it, vi } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import * as payrollAccrual from "./annualLeavePayrollAccrual";
import {
  clearAnnualLeaveMonthWorkSummaryPersistCache,
  getCachedAnnualLeaveMonthWorkSummaryByEmpKey,
  invalidateAnnualLeaveMonthWorkSummaryPersistCache,
} from "./annualLeaveMonthWorkSummaryPersistCache";

describe("getCachedAnnualLeaveMonthWorkSummaryByEmpKey", () => {
  afterEach(() => {
    clearAnnualLeaveMonthWorkSummaryPersistCache();
    vi.restoreAllMocks();
  });

  it("reuses cached emp summaries on consecutive persist calls", () => {
    const buildSpy = vi
      .spyOn(payrollAccrual, "buildAnnualLeaveMonthWorkSummaryForEmpKey")
      .mockReturnValue({ "2026-06": { workDays: 10, standardWorkDays: 12 } });

    const yearData = {
      emp_A: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "A",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-01",
      },
    };
    const attendanceRoot = { "2026-06-01": { emp_A: { mnv: "A" } } };
    const options = { attendanceRootPath: "attendance" };

    const first = getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
      attendanceRoot,
      2026,
      yearData,
      options,
    );
    const second = getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
      attendanceRoot,
      2026,
      yearData,
      options,
    );

    expect(first.emp_A).toEqual({ "2026-06": { workDays: 10, standardWorkDays: 12 } });
    expect(second.emp_A).toBe(first.emp_A);
    expect(buildSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates scoped emp keys and rebuilds them", () => {
    const buildSpy = vi
      .spyOn(payrollAccrual, "buildAnnualLeaveMonthWorkSummaryForEmpKey")
      .mockReturnValueOnce({ "2026-06": { workDays: 10, standardWorkDays: 12 } })
      .mockReturnValueOnce({ "2026-06": { workDays: 11, standardWorkDays: 12 } });

    const yearData = {
      emp_A: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "A",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-01",
      },
    };
    const attendanceRoot = { "2026-06-01": { emp_A: { mnv: "A" } } };
    const options = { attendanceRootPath: "attendance", scopeEmpKeySet: new Set(["emp_A"]) };

    const first = getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
      attendanceRoot,
      2026,
      yearData,
      options,
    );
    invalidateAnnualLeaveMonthWorkSummaryPersistCache({
      year: 2026,
      empKeys: ["emp_A"],
    });
    const second = getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
      attendanceRoot,
      2026,
      yearData,
      options,
    );

    expect(first.emp_A["2026-06"].workDays).toBe(10);
    expect(second.emp_A["2026-06"].workDays).toBe(11);
    expect(buildSpy).toHaveBeenCalledTimes(2);
  });
});
