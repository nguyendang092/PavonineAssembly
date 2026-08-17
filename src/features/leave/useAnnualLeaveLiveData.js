import { useCallback } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import { useAnnualLeaveYearExternal } from "./annualLeaveLiveExternalHooks";
import { useAnnualLeaveAttendanceDerived } from "./useAnnualLeaveAttendanceDerived";

/**
 * Dữ liệu phép năm live — một listener RTDB dùng chung (store) cho cả app.
 */
export function useAnnualLeaveLiveData(
  year,
  {
    attendanceRootPath = "attendance",
    enabled = true,
    throughDateKey = null,
    yearMonthPrefix = null,
    includeAttendance = true,
    includePayrollMonthAccrual = false,
    scopeEmpKeySet = null,
  } = {},
) {
  const skipPayrollMonthAccrual =
    !enabled ||
    !includePayrollMonthAccrual ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
  const skipAttendance =
    !enabled ||
    !includeAttendance ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);

  const { data: yearData, ready: yearReady } = useAnnualLeaveYearExternal(
    year,
    enabled,
  );

  const derived = useAnnualLeaveAttendanceDerived(year, yearData, {
    attendanceRootPath,
    skipAttendance,
    skipPayrollMonthAccrual,
    throughDateKey,
    yearMonthPrefix,
    scopeEmpKeySet,
  });

  const buildBalanceByMnv = useCallback(
    (monthSummaries) => {
      if (skipAttendance || !yearData || !derived.attendanceUsageReady) {
        return {};
      }
      return buildLiveAnnualLeaveBalanceByMnv(
        yearData,
        derived.deductionsByEmpKey,
        year,
        {},
        derived.attendanceMonthlyByEmpKey,
        monthSummaries,
        {
          scopeEmpKeySet,
          asOfDateKey: derived.accrualAsOfDateKey,
        },
      );
    },
    [
      skipAttendance,
      yearData,
      derived.attendanceUsageReady,
      derived.deductionsByEmpKey,
      derived.attendanceMonthlyByEmpKey,
      derived.accrualAsOfDateKey,
      year,
      scopeEmpKeySet,
    ],
  );

  const buildUsageBalanceByMnv = useCallback(
    () => buildBalanceByMnv({}),
    [buildBalanceByMnv],
  );

  const buildAccrualBalanceByMnv = useCallback(() => {
    if (!derived.attendanceAccrualReady) return {};
    return buildBalanceByMnv(derived.monthWorkSummaryByEmpKey);
  }, [
    derived.attendanceAccrualReady,
    derived.monthWorkSummaryByEmpKey,
    buildBalanceByMnv,
  ]);

  const yearLoading = !yearReady;
  const loading =
    yearLoading || derived.attendanceEnhancing || derived.payrollEnhancing;

  return {
    yearData,
    deductionsByEmpKey: derived.deductionsByEmpKey,
    attendanceMonthlyByEmpKey: derived.attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey: derived.monthWorkSummaryByEmpKey,
    loading,
    yearLoading,
    attendanceEnhancing: derived.attendanceEnhancing,
    payrollEnhancing: derived.payrollEnhancing,
    yearReady,
    attendanceReady: derived.attendanceReady,
    attendanceDerivedReady: derived.attendanceUsageReady,
    accrualDerivedReady: derived.attendanceAccrualReady,
    buildUsageBalanceByMnv,
    buildAccrualBalanceByMnv,
  };
}

export { useAnnualLeaveYearExternal } from "./annualLeaveLiveExternalHooks";
