import { useMemo } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./annualLeaveBalanceLookup";
import {
  useAttendanceJoinMonthsExternal,
  useAttendanceYearExternal,
} from "./annualLeaveLiveExternalHooks";
import {
  buildAnnualLeaveMonthWorkSummaryByEmpKey,
  listAnnualLeaveAccrualYearMonths,
} from "./annualLeavePayrollAccrual";

const EMPTY_DERIVED = Object.freeze({
  deductionsByEmpKey: {},
  attendanceMonthlyByEmpKey: {},
});

/**
 * Tải & tính điểm danh live cho lưới quản lý phép năm.
 * Chỉ coi đã tính xong khi có đủ dữ liệu điểm danh — tránh hiển thị số tạm sai cột ANNUAL LEAVE IN CURRENT YEAR.
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
  } = {},
) {
  const skipAttendance =
    !enabled || shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
  const skipPayrollMonthAccrual =
    !enabled ||
    !includePayrollMonthAccrual ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);

  const accrualYearMonths = useMemo(() => {
    if (skipPayrollMonthAccrual || !yearData) return [];
    return listAnnualLeaveAccrualYearMonths(yearData, year);
  }, [skipPayrollMonthAccrual, yearData, year]);

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

  const attendanceRootForDerived =
    skipAttendance || !attendanceReady ? null : attendanceRoot;
  const payrollRootForMonthAccrual = skipAttendance
    ? payrollMonthAttendanceReady
      ? payrollMonthAttendanceRoot
      : null
    : attendanceRootForDerived;

  const attendanceCalculated = skipAttendance
    ? skipPayrollMonthAccrual ||
      accrualYearMonths.length === 0 ||
      payrollMonthAttendanceReady
    : attendanceReady && Boolean(attendanceRoot) && Boolean(yearData);

  const attendanceDerived = useMemo(() => {
    if (!attendanceCalculated || skipAttendance || !attendanceRootForDerived) {
      return EMPTY_DERIVED;
    }
    return buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRootForDerived,
      year,
      deductionFilter,
    );
  }, [
    attendanceCalculated,
    attendanceRootForDerived,
    year,
    deductionFilter,
    skipAttendance,
  ]);

  const monthWorkSummaryByEmpKey = useMemo(() => {
    if (
      !attendanceCalculated ||
      skipPayrollMonthAccrual ||
      !yearData ||
      !payrollRootForMonthAccrual
    ) {
      return {};
    }
    if (skipAttendance && !payrollMonthAttendanceReady) {
      return {};
    }
    return buildAnnualLeaveMonthWorkSummaryByEmpKey(
      payrollRootForMonthAccrual,
      year,
      yearData,
      { attendanceRootPath },
    );
  }, [
    attendanceCalculated,
    skipPayrollMonthAccrual,
    payrollRootForMonthAccrual,
    year,
    yearData,
    attendanceRootPath,
    skipAttendance,
    payrollMonthAttendanceReady,
  ]);

  const attendanceEnhancing = !attendanceCalculated;

  return {
    deductionsByEmpKey: attendanceDerived.deductionsByEmpKey,
    attendanceMonthlyByEmpKey: attendanceDerived.attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceEnhancing,
    attendanceCalculated,
    attendanceReady: skipAttendance || attendanceReady,
  };
}
