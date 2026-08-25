import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { resolveAnnualLeaveYearAsOfDateKey } from "./annualLeaveCalculated";
import {
  buildDerivedMapsFilterKey,
  buildMonthWorkSummaryBucketKey,
  scopeEmpKeySetToCacheKey,
  syncAttendanceDerivedMaps,
  syncMonthWorkSummaryMaps,
} from "./annualLeaveDerivedRuntimeCache";
import {
  useAttendanceJoinMonthsExternal,
  useAttendanceYearExternal,
} from "./annualLeaveLiveExternalHooks";
import {
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

function buildAttendanceScopeKey(attendanceRootPath, year, throughDateKey) {
  return `${attendanceRootPath}:${year}:${throughDateKey ?? "full"}`;
}

/**
 * Tải điểm danh + tính derived maps / accrual — diff incremental theo empKey.
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
    accrualThroughMonthIndex = null,
  } = {},
) {
  const scopeEmpKeyKey = useMemo(
    () => scopeEmpKeySetToCacheKey(scopeEmpKeySet),
    [scopeEmpKeySet],
  );

  const accrualYearMonths = useMemo(() => {
    if (skipPayrollMonthAccrual || !yearData) return [];
    return listAnnualLeaveAccrualYearMonths(yearData, year, {
      scopeEmpKeySet,
      throughMonthIndex: accrualThroughMonthIndex,
    });
  }, [
    skipPayrollMonthAccrual,
    yearData,
    year,
    scopeEmpKeyKey,
    accrualThroughMonthIndex,
    scopeEmpKeySet,
  ]);

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
    [throughDateKey, yearMonthPrefix, scopeEmpKeyKey],
  );

  const derivedMapsFilterKey = useMemo(
    () =>
      buildDerivedMapsFilterKey({
        throughDateKey,
        yearMonthPrefix,
      }),
    [throughDateKey, yearMonthPrefix],
  );

  const attendanceScopeKey = useMemo(
    () => buildAttendanceScopeKey(attendanceRootPath, year, throughDateKey),
    [attendanceRootPath, year, throughDateKey],
  );

  const accrualAsOfDateKey = useMemo(
    () => resolveAnnualLeaveYearAsOfDateKey(year),
    [year],
  );

  const monthWorkSummaryBucketKey = useMemo(
    () => buildMonthWorkSummaryBucketKey(year, accrualAsOfDateKey),
    [year, accrualAsOfDateKey],
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
  const [usageReadyTick, setUsageReadyTick] = useState(0);

  const derivedMapsRef = useRef(EMPTY_DERIVED);
  const monthSummaryRef = useRef(EMPTY_SUMMARY);
  const usageReadyEmpKeysRef = useRef(new Set());
  const accrualReadyEmpKeysRef = useRef(new Set());
  const lastIncrementalRef = useRef({
    affectedEmpKeys: new Set(),
    changedDateKeys: new Set(),
  });

  derivedMapsRef.current = derivedMaps;
  monthSummaryRef.current = monthWorkSummaryByEmpKey;

  const resetUsageReadyForScope = useCallback((scopeSet) => {
    usageReadyEmpKeysRef.current = new Set();
    accrualReadyEmpKeysRef.current = new Set();
    if (!(scopeSet instanceof Set) || scopeSet.size === 0) return;
    setUsageReadyTick((t) => t + 1);
  }, []);

  useEffect(() => {
    resetUsageReadyForScope(scopeEmpKeySet);
  }, [scopeEmpKeyKey, attendanceScopeKey, resetUsageReadyForScope]);

  useEffect(() => {
    if (skipAttendance) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(true);
      usageReadyEmpKeysRef.current = new Set();
      setUsageReadyTick((t) => t + 1);
      return;
    }

    if (!attendanceReady || !deferredAttendanceRoot || !yearData) {
      setDerivedMaps(EMPTY_DERIVED);
      setUsageDerived(false);
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const { maps, recomputedEmpKeys } = syncAttendanceDerivedMaps({
        attendanceRoot: deferredAttendanceRoot,
        year,
        filterKey: derivedMapsFilterKey,
        deductionFilter,
        scopeEmpKeySet,
        attendanceScopeKey,
        prevMaps: derivedMapsRef.current,
      });

      if (cancelled) return;

      for (const empKey of recomputedEmpKeys) {
        usageReadyEmpKeysRef.current.add(empKey);
      }
      if (
        scopeEmpKeySet instanceof Set &&
        scopeEmpKeySet.size > 0 &&
        [...scopeEmpKeySet].every((k) => usageReadyEmpKeysRef.current.has(k))
      ) {
        for (const empKey of scopeEmpKeySet) {
          usageReadyEmpKeysRef.current.add(empKey);
        }
      } else if (!scopeEmpKeySet && recomputedEmpKeys.size > 0) {
        for (const empKey of recomputedEmpKeys) {
          usageReadyEmpKeysRef.current.add(empKey);
        }
      }

      lastIncrementalRef.current.affectedEmpKeys = recomputedEmpKeys;
      setDerivedMaps(maps);
      setUsageDerived(true);
      setUsageReadyTick((t) => t + 1);
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
    derivedMapsFilterKey,
    scopeEmpKeyKey,
    attendanceScopeKey,
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
      const merged = syncMonthWorkSummaryMaps({
        attendanceRoot: payrollRootForAccrual,
        year,
        yearData,
        bucketKey: monthWorkSummaryBucketKey,
        attendanceRootPath,
        scopeEmpKeySet,
        affectedEmpKeys: lastIncrementalRef.current.affectedEmpKeys,
        prevScopedMaps: monthSummaryRef.current,
      });

      if (cancelled) return;

      if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
        for (const empKey of scopeEmpKeySet) {
          accrualReadyEmpKeysRef.current.add(empKey);
        }
      }

      setMonthWorkSummaryByEmpKey(merged);
      setAccrualDerived(true);
      setUsageReadyTick((t) => t + 1);
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
    scopeEmpKeyKey,
    monthWorkSummaryBucketKey,
  ]);

  const isEmpUsageReady = useCallback(
    (empKey) => {
      if (skipAttendance) return true;
      if (!usageDerived) return false;
      if (!empKey) return false;
      if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
        return usageDerived;
      }
      return usageReadyEmpKeysRef.current.has(empKey);
    },
    [skipAttendance, usageDerived, scopeEmpKeySet, usageReadyTick],
  );

  const isEmpAccrualReady = useCallback(
    (empKey) => {
      if (skipPayrollMonthAccrual || accrualYearMonths.length === 0) {
        return true;
      }
      if (!accrualDerived) return false;
      if (!empKey) return false;
      if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
        return accrualDerived;
      }
      return accrualReadyEmpKeysRef.current.has(empKey);
    },
    [
      skipPayrollMonthAccrual,
      accrualYearMonths.length,
      accrualDerived,
      scopeEmpKeySet,
      usageReadyTick,
    ],
  );

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
    isEmpUsageReady,
    isEmpAccrualReady,
  };
}
