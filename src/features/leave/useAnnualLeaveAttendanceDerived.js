import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./annualLeaveBalanceLookup";
import { resolveAnnualLeaveYearAsOfDateKey } from "./annualLeaveCalculated";
import {
  useAttendanceJoinMonthsExternal,
  useAttendanceYearExternal,
} from "./annualLeaveLiveExternalHooks";
import {
  buildAnnualLeaveMonthWorkSummaryByEmpKey,
  listAnnualLeaveAccrualYearMonths,
  mergeAttendanceRootsForPayrollAccrual,
} from "./annualLeavePayrollAccrual";

const EMPTY_DERIVED = Object.freeze({
  deductionsByEmpKey: {},
  attendanceMonthlyByEmpKey: {},
});

const EMPTY_SUMMARY = Object.freeze({});

function buildDeductionFilter({
  throughDateKey,
  yearMonthPrefix,
  scopeEmpKeySet,
}) {
  const filter = {};
  if (throughDateKey) filter.throughDateKey = throughDateKey;
  else if (yearMonthPrefix) filter.yearMonthPrefix = yearMonthPrefix;
  if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
    filter.scopeEmpKeySet = scopeEmpKeySet;
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

/**
 * Tải điểm danh + tính derived maps / accrual — dùng chung manager & balance map.
 */
export function useAnnualLeaveAttendanceDerived(
  year,
  yearData,
  {
    attendanceRootPath = "attendance",
    skipAttendance = false,
    skipPayrollMonthAccrual = false,
    throughDateKey = null,
    yearMonthPrefix = null,
    scopeEmpKeySet = null,
  } = {},
) {
  const accrualYearMonths = useMemo(() => {
    if (skipPayrollMonthAccrual || !yearData) return [];
    return listAnnualLeaveAccrualYearMonths(yearData, year);
  }, [skipPayrollMonthAccrual, yearData, year]);

  const {
    data: payrollMonthAttendanceRoot,
    ready: payrollMonthAttendanceReady,
  } = useAttendanceJoinMonthsExternal(
    attendanceRootPath,
    year,
    accrualYearMonths,
    skipPayrollMonthAccrual,
  );

  const { data: attendanceRoot, ready: attendanceReady } =
    useAttendanceYearExternal(
      attendanceRootPath,
      year,
      skipAttendance,
      throughDateKey,
    );

  const deductionFilter = useMemo(
    () =>
      buildDeductionFilter({
        throughDateKey,
        yearMonthPrefix,
        scopeEmpKeySet,
      }),
    [throughDateKey, yearMonthPrefix, scopeEmpKeySet],
  );

  const accrualAsOfDateKey = useMemo(
    () => resolveAnnualLeaveYearAsOfDateKey(year),
    [year],
  );

  const deferredAttendanceRoot = useDeferredValue(
    skipAttendance || !attendanceReady ? null : attendanceRoot,
  );
  const deferredPayrollMonthAttendanceRoot = useDeferredValue(
    payrollMonthAttendanceRoot,
  );

  const payrollRootForAccrual = useMemo(() => {
    if (skipPayrollMonthAccrual) return null;
    if (skipAttendance) return deferredPayrollMonthAttendanceRoot;
    return mergeAttendanceRootsForPayrollAccrual(
      deferredAttendanceRoot,
      deferredPayrollMonthAttendanceRoot,
    );
  }, [
    skipPayrollMonthAccrual,
    skipAttendance,
    deferredAttendanceRoot,
    deferredPayrollMonthAttendanceRoot,
  ]);

  const [derivedMaps, setDerivedMaps] = useState(EMPTY_DERIVED);
  const [monthWorkSummaryByEmpKey, setMonthWorkSummaryByEmpKey] =
    useState(EMPTY_SUMMARY);
  const [usageDerived, setUsageDerived] = useState(false);
  const [accrualDerived, setAccrualDerived] = useState(false);

  useEffect(() => {
    if (skipAttendance) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(true);
      return;
    }

    if (!attendanceReady || !deferredAttendanceRoot || !yearData) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(false);
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = buildAttendanceAnnualLeaveDerivedMaps(
        deferredAttendanceRoot,
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
    deferredAttendanceRoot,
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
    } else if (!usageDerived || !payrollRootForAccrual) {
      setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
      setAccrualDerived(false);
      return;
    } else if (
      accrualYearMonths.length > 0 &&
      !payrollMonthAttendanceReady
    ) {
      setMonthWorkSummaryByEmpKey(EMPTY_SUMMARY);
      setAccrualDerived(false);
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = buildAnnualLeaveMonthWorkSummaryByEmpKey(
        payrollRootForAccrual,
        year,
        yearData,
        {
          attendanceRootPath,
          scopeEmpKeySet:
            scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0
              ? scopeEmpKeySet
              : null,
        },
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
    attendanceRootPath,
    scopeEmpKeySet,
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
  const payrollEnhancing =
    !skipPayrollMonthAccrual &&
    accrualYearMonths.length > 0 &&
    !payrollMonthAttendanceReady;

  return {
    deductionsByEmpKey: derivedMaps.deductionsByEmpKey,
    attendanceMonthlyByEmpKey: derivedMaps.attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    accrualAsOfDateKey,
    accrualYearMonths,
    attendanceEnhancing,
    attendanceUsageReady,
    attendanceAccrualReady,
    attendanceCalculated,
    payrollEnhancing,
    attendanceReady: skipAttendance || attendanceReady,
  };
}
