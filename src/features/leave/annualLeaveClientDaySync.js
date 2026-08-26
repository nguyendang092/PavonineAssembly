import { annualLeaveYearFromDateKey } from "./annualLeaveBalanceLookup";
import {
  applyLeaveAggDeltasForDayChange,
  applyAnnualLeaveDeductionDelta,
  invalidateAnnualLeaveMonthWorkSummaryPersistCache,
  persistAnnualLeaveMonthFromAttendance,
  persistSingleEmployeeAnnualLeaveFromAttendance,
} from "./annualLeaveAttendanceSync";

/**
 * Client fallback: cập nhật agg theo diff 1 ngày rồi persist phép (1 NV hoặc theo tháng).
 */
export async function syncAnnualLeaveAfterAttendanceDayChange(
  db,
  {
    dateKey,
    attendanceRootPath = "attendance",
    previousDayData = null,
    nextDayData = null,
    scopeEmpKeySet = null,
    updatedBy = "",
  },
) {
  const year = annualLeaveYearFromDateKey(dateKey);

  invalidateAnnualLeaveMonthWorkSummaryPersistCache({
    year,
    attendanceRootPath,
    empKeys:
      scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0
        ? [...scopeEmpKeySet]
        : null,
  });

  await applyLeaveAggDeltasForDayChange(db, {
    year,
    dateKey,
    previousDayData,
    nextDayData,
    updatedBy,
  });

  if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size === 1) {
    const empKey = [...scopeEmpKeySet][0];
    return persistSingleEmployeeAnnualLeaveFromAttendance(db, {
      year,
      empKey,
      attendanceRootPath,
      updatedBy,
    });
  }

  return persistAnnualLeaveMonthFromAttendance(db, {
    year,
    dateKey,
    attendanceRootPath,
    updatedBy,
    scopeEmpKeySet,
    monthAttendanceOverride: nextDayData ?? null,
  });
}

export { applyAnnualLeaveDeductionDelta };
