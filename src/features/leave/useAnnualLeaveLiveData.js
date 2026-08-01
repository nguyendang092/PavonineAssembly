import { useMemo, useDeferredValue } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import {
  buildAttendanceAnnualLeaveDeductionsByMnv,
  buildAttendanceAnnualLeaveDerivedMaps,
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
} from "./annualLeaveBalanceLookup";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import {
  useAnnualLeaveYearExternal,
  useAttendanceJoinMonthsExternal,
  useAttendanceYearExternal,
} from "./annualLeaveLiveExternalHooks";
import {
  buildAnnualLeaveMonthWorkSummaryByEmpKey,
  listAnnualLeaveAccrualYearMonths,
} from "./annualLeavePayrollAccrual";

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
    includeUsageDetail = true,
    includeBalanceMap = true,
    includeAttendance = true,
    includePayrollMonthAccrual = false,
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

  const accrualYearMonths = useMemo(() => {
    if (skipPayrollMonthAccrual || !yearReady || !yearData) return [];
    return listAnnualLeaveAccrualYearMonths(yearData, year);
  }, [skipPayrollMonthAccrual, yearReady, yearData, year]);

  const skipScopedPayrollAttendance =
    skipPayrollMonthAccrual || !skipAttendance;

  const {
    data: payrollMonthAttendanceRoot,
    ready: payrollMonthAttendanceReady,
  } = useAttendanceJoinMonthsExternal(
    attendanceRootPath,
    year,
    accrualYearMonths,
    skipScopedPayrollAttendance,
  );

  const { data: attendanceRoot, ready: attendanceReady } =
    useAttendanceYearExternal(
      attendanceRootPath,
      year,
      skipAttendance,
      throughDateKey,
    );

  const deductionFilter = useMemo(() => {
    if (throughDateKey) return { throughDateKey };
    if (yearMonthPrefix) return { yearMonthPrefix };
    return null;
  }, [throughDateKey, yearMonthPrefix]);

  const deferredAttendanceRoot = useDeferredValue(attendanceRoot);
  const deferredPayrollMonthAttendanceRoot = useDeferredValue(
    payrollMonthAttendanceRoot,
  );
  const attendanceRootForDerived = skipAttendance
    ? null
    : deferredAttendanceRoot;
  const payrollRootForMonthAccrual = skipAttendance
    ? deferredPayrollMonthAttendanceRoot
    : deferredAttendanceRoot;

  const attendanceDerived = useMemo(() => {
    if (skipAttendance || !attendanceRootForDerived) {
      return {
        deductionsByEmpKey: {},
        attendanceMonthlyByEmpKey: {},
      };
    }
    if (includeUsageDetail) {
      return {
        deductionsByEmpKey: buildAttendanceAnnualLeaveDeductionsByMnv(
          attendanceRootForDerived,
          year,
          deductionFilter,
        ),
        attendanceMonthlyByEmpKey: {},
      };
    }
    return buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRootForDerived,
      year,
      deductionFilter,
    );
  }, [
    attendanceRootForDerived,
    year,
    deductionFilter,
    skipAttendance,
    includeUsageDetail,
  ]);

  const deductionsByEmpKey = attendanceDerived.deductionsByEmpKey;
  const attendanceMonthlyByEmpKey = attendanceDerived.attendanceMonthlyByEmpKey;

  const monthWorkSummaryByEmpKey = useMemo(() => {
    if (
      skipPayrollMonthAccrual ||
      !yearData ||
      !payrollRootForMonthAccrual
    ) {
      return {};
    }
    return buildAnnualLeaveMonthWorkSummaryByEmpKey(
      payrollRootForMonthAccrual,
      year,
      yearData,
      { attendanceRootPath },
    );
  }, [
    skipPayrollMonthAccrual,
    payrollRootForMonthAccrual,
    year,
    yearData,
    attendanceRootPath,
  ]);

  const usageDetailByEmpKey = useMemo(
    () =>
      skipAttendance || !includeUsageDetail || !attendanceRootForDerived
        ? {}
        : buildAttendanceAnnualLeaveUsageDetailByEmpKey(
            attendanceRootForDerived,
            year,
            deductionFilter,
          ),
    [
      attendanceRootForDerived,
      year,
      deductionFilter,
      skipAttendance,
      includeUsageDetail,
    ],
  );

  const balanceByMnv = useMemo(
    () =>
      skipAttendance || !includeBalanceMap
        ? {}
        : buildLiveAnnualLeaveBalanceByMnv(
            yearData,
            deductionsByEmpKey,
            year,
            usageDetailByEmpKey,
            attendanceMonthlyByEmpKey,
            monthWorkSummaryByEmpKey,
          ),
    [
      yearData,
      deductionsByEmpKey,
      skipAttendance,
      includeBalanceMap,
      year,
      usageDetailByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
    ],
  );

  const yearLoading = !yearReady;
  const attendanceEnhancing = !skipAttendance && !attendanceReady;
  const payrollEnhancing =
    skipAttendance &&
    includePayrollMonthAccrual &&
    accrualYearMonths.length > 0 &&
    !payrollMonthAttendanceReady;
  const loading = yearLoading || attendanceEnhancing || payrollEnhancing;

  return {
    yearData,
    attendanceRoot: skipAttendance ? null : attendanceRoot,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    balanceByMnv,
    usageDetailByEmpKey,
    loading,
    yearLoading,
    attendanceEnhancing,
    payrollEnhancing,
    yearReady,
    attendanceReady: skipAttendance || attendanceReady,
    throughDateKey,
    yearMonthPrefix,
  };
}

export { useAnnualLeaveYearExternal } from "./annualLeaveLiveExternalHooks";
