import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./annualLeaveBalanceLookup";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import { resolveAnnualLeaveYearAsOfDateKey } from "./annualLeaveCalculated";
import {
  useAnnualLeaveYearExternal,
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

  const accrualAsOfDateKey = useMemo(
    () => throughDateKey ?? resolveAnnualLeaveYearAsOfDateKey(year),
    [throughDateKey, year],
  );

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

  const [derivedMaps, setDerivedMaps] = useState(EMPTY_DERIVED);
  const [monthWorkSummaryByEmpKey, setMonthWorkSummaryByEmpKey] = useState({});
  const [attendanceDerivedReady, setAttendanceDerivedReady] = useState(false);
  const [accrualDerivedReady, setAccrualDerivedReady] = useState(false);

  useEffect(() => {
    if (skipAttendance || !attendanceReady || !attendanceRootForDerived) {
      setDerivedMaps(EMPTY_DERIVED);
      setAttendanceDerivedReady(false);
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = buildAttendanceAnnualLeaveDerivedMaps(
        attendanceRootForDerived,
        year,
        deductionFilter,
      );
      if (!cancelled) {
        setDerivedMaps(next);
        setAttendanceDerivedReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    skipAttendance,
    attendanceReady,
    attendanceRootForDerived,
    year,
    deductionFilter,
  ]);

  useEffect(() => {
    if (skipPayrollMonthAccrual || !yearData) {
      setMonthWorkSummaryByEmpKey({});
      setAccrualDerivedReady(true);
      return;
    }

    if (!attendanceDerivedReady) {
      setMonthWorkSummaryByEmpKey({});
      setAccrualDerivedReady(false);
      return;
    }

    if (!payrollRootForMonthAccrual) {
      setAccrualDerivedReady(false);
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = buildAnnualLeaveMonthWorkSummaryByEmpKey(
        payrollRootForMonthAccrual,
        year,
        yearData,
        { attendanceRootPath, scopeEmpKeySet },
      );
      if (!cancelled) {
        setMonthWorkSummaryByEmpKey(next);
        setAccrualDerivedReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    skipPayrollMonthAccrual,
    yearData,
    year,
    attendanceRootPath,
    scopeEmpKeySet,
    attendanceDerivedReady,
    payrollRootForMonthAccrual,
  ]);

  const deductionsByEmpKey = derivedMaps.deductionsByEmpKey;
  const attendanceMonthlyByEmpKey = derivedMaps.attendanceMonthlyByEmpKey;

  const buildBalanceByMnv = useCallback(
    (monthSummaries) => {
      if (skipAttendance || !yearData || !attendanceDerivedReady) return {};
      return buildLiveAnnualLeaveBalanceByMnv(
        yearData,
        deductionsByEmpKey,
        year,
        {},
        attendanceMonthlyByEmpKey,
        monthSummaries,
        { scopeEmpKeySet, asOfDateKey: accrualAsOfDateKey },
      );
    },
    [
      skipAttendance,
      yearData,
      attendanceDerivedReady,
      deductionsByEmpKey,
      year,
      attendanceMonthlyByEmpKey,
      scopeEmpKeySet,
      accrualAsOfDateKey,
    ],
  );

  const buildUsageBalanceByMnv = useCallback(
    () => buildBalanceByMnv({}),
    [buildBalanceByMnv],
  );

  const buildAccrualBalanceByMnv = useCallback(() => {
    if (!accrualDerivedReady) return {};
    return buildBalanceByMnv(monthWorkSummaryByEmpKey);
  }, [accrualDerivedReady, buildBalanceByMnv, monthWorkSummaryByEmpKey]);

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
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    loading,
    yearLoading,
    attendanceEnhancing,
    payrollEnhancing,
    yearReady,
    attendanceReady: skipAttendance || attendanceReady,
    attendanceDerivedReady: skipAttendance || attendanceDerivedReady,
    accrualDerivedReady: skipPayrollMonthAccrual || accrualDerivedReady,
    buildUsageBalanceByMnv,
    buildAccrualBalanceByMnv,
  };
}

export { useAnnualLeaveYearExternal } from "./annualLeaveLiveExternalHooks";
