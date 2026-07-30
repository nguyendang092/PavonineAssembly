import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
 * Tải & tính điểm danh live — tách khỏi toolbar; tính nặng chạy sau transition.
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
    !enabled ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
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

  const [, startTransition] = useTransition();
  const [attendanceUiReady, setAttendanceUiReady] = useState(false);

  useEffect(() => {
    if (skipAttendance || !attendanceReady) {
      setAttendanceUiReady(false);
      return;
    }
    startTransition(() => setAttendanceUiReady(true));
  }, [skipAttendance, attendanceReady]);

  const attendanceDerived = useMemo(() => {
    if (
      skipAttendance ||
      !attendanceUiReady ||
      !attendanceRootForDerived
    ) {
      return EMPTY_DERIVED;
    }
    return buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRootForDerived,
      year,
      deductionFilter,
    );
  }, [
    attendanceRootForDerived,
    attendanceUiReady,
    year,
    deductionFilter,
    skipAttendance,
  ]);

  const monthWorkSummaryByEmpKey = useMemo(() => {
    if (
      skipAttendance ||
      !attendanceUiReady ||
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
    attendanceUiReady,
    payrollRootForMonthAccrual,
    year,
    yearData,
    attendanceRootPath,
    skipAttendance,
  ]);

  const attendanceEnhancing = !skipAttendance && !attendanceReady;
  const payrollEnhancing =
    skipAttendance &&
    includePayrollMonthAccrual &&
    accrualYearMonths.length > 0 &&
    !payrollMonthAttendanceReady;

  return {
    deductionsByEmpKey: attendanceDerived.deductionsByEmpKey,
    attendanceMonthlyByEmpKey: attendanceDerived.attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceEnhancing: attendanceEnhancing || payrollEnhancing,
    attendanceReady: skipAttendance || attendanceReady,
  };
}
