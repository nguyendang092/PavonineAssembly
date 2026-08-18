import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
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
  } = {},
) {
  const skipAttendance =
    !enabled || shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
  const skipPayrollMonthAccrual =
    !enabled ||
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
