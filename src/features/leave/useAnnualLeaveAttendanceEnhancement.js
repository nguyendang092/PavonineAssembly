import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { isAnnualLeaveStoredDisplayEnabled } from "@/config/annualLeaveClientSync";
import { useAnnualLeaveAttendanceDerived } from "./useAnnualLeaveAttendanceDerived";

export { useAnnualLeaveAttendanceDerived };

/**
 * Tải & tính điểm danh live cho lưới quản lý phép năm.
 */
export function useAnnualLeaveAttendanceEnhancement(
  year,
  yearData,
  {
    attendanceRootPath = "attendance",
    enabled = true,
    throughDateKey = null,
    yearMonthPrefix = null,
    includePayrollMonthAccrual = true,
    scopeEmpKeySet = null,
    accrualThroughMonthIndex = null,
    storedOnlyDisplay = isAnnualLeaveStoredDisplayEnabled(),
  } = {},
) {
  const skipLiveAttendance =
    storedOnlyDisplay ||
    !enabled ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
  const skipAttendance = skipLiveAttendance;
  const skipPayrollMonthAccrual =
    skipLiveAttendance ||
    !includePayrollMonthAccrual ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);

  return useAnnualLeaveAttendanceDerived(year, yearData, {
    attendanceRootPath,
    skipAttendance,
    skipPayrollMonthAccrual,
    throughDateKey,
    yearMonthPrefix,
    scopeEmpKeySet,
    accrualThroughMonthIndex,
  });
}
