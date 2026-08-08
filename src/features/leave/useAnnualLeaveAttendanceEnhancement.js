import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
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

const EMPTY_SUMMARY = Object.freeze({});

/**
 * Tải & tính điểm danh live cho lưới quản lý phép năm.
 * Tính theo 2 giai đoạn (usage → accrual) + startTransition để không block UI.
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

  const deferredAttendanceRoot = useDeferredValue(
    skipAttendance || !attendanceReady ? null : attendanceRoot,
  );
  const deferredPayrollMonthAttendanceRoot = useDeferredValue(
    payrollMonthAttendanceRoot,
  );

  const [derivedMaps, setDerivedMaps] = useState(EMPTY_DERIVED);
  const [monthWorkSummaryByEmpKey, setMonthWorkSummaryByEmpKey] =
    useState(EMPTY_SUMMARY);
  const [usageDerived, setUsageDerived] = useState(false);
  const [accrualDerived, setAccrualDerived] = useState(false);

  const attendanceRootForUsage =
    skipAttendance || !attendanceReady ? null : deferredAttendanceRoot;
  const payrollRootForAccrual = skipAttendance
    ? deferredPayrollMonthAttendanceRoot
    : deferredAttendanceRoot;

  useEffect(() => {
    if (skipAttendance) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(true);
      return;
    }

    if (!attendanceReady || !attendanceRoot || !yearData) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(false);
      return;
    }

    const root = attendanceRootForUsage ?? attendanceRoot;
    let cancelled = false;

    startTransition(() => {
      const next = buildAttendanceAnnualLeaveDerivedMaps(
        root,
        year,
        deductionFilter,
      );
      if (!cancelled) {
        setDerivedMaps(next);
        setUsageDerived(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    skipAttendance,
    attendanceReady,
    attendanceRoot,
    attendanceRootForUsage,
    yearData,
    year,
    deductionFilter,
  ]);

  useEffect(() => {
    if (skipPayrollMonthAccrual || !yearData) {
      setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
      setAccrualDerived(true);
      return;
    }

    if (skipAttendance) {
      if (accrualYearMonths.length === 0) {
        setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
        setAccrualDerived(true);
        return;
      }
      if (!payrollMonthAttendanceReady || !payrollRootForAccrual) {
        setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
        setAccrualDerived(false);
        return;
      }
    } else if (!usageDerived || !attendanceReady || !attendanceRoot) {
      setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
      setAccrualDerived(false);
      return;
    } else if (!payrollRootForAccrual) {
      setAccrualDerived(false);
      return;
    }

    let cancelled = false;

    startTransition(() => {
      const next = buildAnnualLeaveMonthWorkSummaryByEmpKey(
        payrollRootForAccrual,
        year,
        yearData,
        { attendanceRootPath },
      );
      if (!cancelled) {
        setMonthWorkSummaryByEmpKey(next);
        setAccrualDerived(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    skipPayrollMonthAccrual,
    yearData,
    year,
    skipAttendance,
    accrualYearMonths.length,
    payrollMonthAttendanceReady,
    payrollRootForAccrual,
    usageDerived,
    attendanceReady,
    attendanceRoot,
    attendanceRootPath,
  ]);

  const attendanceUsageReady = skipAttendance
    ? true
    : usageDerived && attendanceReady && Boolean(yearData);

  const attendanceAccrualReady =
    skipPayrollMonthAccrual ||
    accrualYearMonths.length === 0 ||
    accrualDerived;

  const attendanceCalculated = attendanceUsageReady && attendanceAccrualReady;
  const attendanceEnhancing = !attendanceCalculated;

  return {
    deductionsByEmpKey: derivedMaps.deductionsByEmpKey,
    attendanceMonthlyByEmpKey: derivedMaps.attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceEnhancing,
    attendanceUsageReady,
    attendanceAccrualReady,
    attendanceCalculated,
    attendanceReady: skipAttendance || attendanceReady,
  };
}
