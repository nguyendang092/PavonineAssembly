import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { buildStoredAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";

function normalizeScopeEmpKeys(scopeEmpKeys) {
  if (!Array.isArray(scopeEmpKeys)) return null;
  return new Set(scopeEmpKeys.filter(Boolean));
}

function pickScopedBalanceMap(map, scopeEmpKeySet) {
  if (!scopeEmpKeySet) return map;
  const scoped = {};
  for (const empKey of scopeEmpKeySet) {
    if (map[empKey] != null) scoped[empKey] = map[empKey];
  }
  return scoped;
}

/**
 * Map MNV → BALANCE cho cột điểm danh / giờ công.
 * Tự tải; hiển thị Firebase ngay; chỉ tính live theo trang hiện tại.
 */
export function useAnnualLeaveBalanceMap(year, options = {}) {
  const {
    enabled = true,
    attendanceRootPath = "attendance",
    scopeEmpKeys = null,
    throughDateKey = null,
    yearMonthPrefix = null,
    ...rest
  } = options;

  const skipAnnualLeave = shouldSkipAnnualLeaveForAttendanceRoot(
    attendanceRootPath,
  );
  const liveEnabled = enabled && !skipAnnualLeave;

  const scopeEmpKeySet = useMemo(
    () => normalizeScopeEmpKeys(scopeEmpKeys),
    [scopeEmpKeys],
  );

  const [attendanceLoadReady, setAttendanceLoadReady] = useState(false);

  useEffect(() => {
    if (!liveEnabled) {
      setAttendanceLoadReady(false);
      return;
    }
    setAttendanceLoadReady(false);
    const frameId = requestAnimationFrame(() => {
      setAttendanceLoadReady(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, [liveEnabled, year, throughDateKey, yearMonthPrefix, attendanceRootPath]);

  const live = useAnnualLeaveLiveData(year, {
    enabled: liveEnabled && attendanceLoadReady,
    attendanceRootPath,
    throughDateKey,
    yearMonthPrefix,
    includeUsageDetail: false,
    includeBalanceMap: false,
    includeAttendance: true,
    includePayrollMonthAccrual: true,
    scopeEmpKeySet,
    ...rest,
  });

  const storedBalanceByMnv = useMemo(
    () =>
      pickScopedBalanceMap(
        buildStoredAnnualLeaveBalanceByMnv(live.yearData),
        scopeEmpKeySet,
      ),
    [live.yearData, scopeEmpKeySet],
  );

  const [balanceCache, setBalanceCache] = useState({});

  useEffect(() => {
    setBalanceCache({});
  }, [year, throughDateKey, yearMonthPrefix, attendanceRootPath]);

  const [usageBalanceByMnv, setUsageBalanceByMnv] = useState({});
  const [accrualBalanceByMnv, setAccrualBalanceByMnv] = useState({});

  useEffect(() => {
    if (!liveEnabled || !live.attendanceDerivedReady) {
      setUsageBalanceByMnv({});
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = live.buildUsageBalanceByMnv?.() ?? {};
      if (!cancelled) setUsageBalanceByMnv(next);
    });

    return () => {
      cancelled = true;
    };
  }, [
    liveEnabled,
    live.attendanceDerivedReady,
    live.buildUsageBalanceByMnv,
  ]);

  useEffect(() => {
    if (!liveEnabled || !live.accrualDerivedReady) {
      setAccrualBalanceByMnv({});
      return;
    }

    let cancelled = false;
    startTransition(() => {
      const next = live.buildAccrualBalanceByMnv?.() ?? {};
      if (!cancelled) setAccrualBalanceByMnv(next);
    });

    return () => {
      cancelled = true;
    };
  }, [
    liveEnabled,
    live.accrualDerivedReady,
    live.buildAccrualBalanceByMnv,
  ]);

  useEffect(() => {
    if (Object.keys(accrualBalanceByMnv).length > 0) {
      setBalanceCache((prev) => ({ ...prev, ...accrualBalanceByMnv }));
    }
  }, [accrualBalanceByMnv]);

  const deferredUsageBalanceByMnv = useDeferredValue(usageBalanceByMnv);
  const deferredAccrualBalanceByMnv = useDeferredValue(accrualBalanceByMnv);

  const balanceEnhancing =
    liveEnabled &&
    (live.yearLoading ||
      !attendanceLoadReady ||
      live.attendanceEnhancing ||
      live.payrollEnhancing ||
      (live.attendanceDerivedReady && !live.accrualDerivedReady));

  const balanceByMnv = useMemo(() => {
    if (!liveEnabled) return {};

    const merged = { ...balanceCache, ...storedBalanceByMnv };
    if (Object.keys(deferredUsageBalanceByMnv).length > 0) {
      Object.assign(merged, deferredUsageBalanceByMnv);
    }
    if (Object.keys(deferredAccrualBalanceByMnv).length > 0) {
      Object.assign(merged, deferredAccrualBalanceByMnv);
    }

    return pickScopedBalanceMap(merged, scopeEmpKeySet);
  }, [
    liveEnabled,
    balanceCache,
    storedBalanceByMnv,
    deferredUsageBalanceByMnv,
    deferredAccrualBalanceByMnv,
    scopeEmpKeySet,
  ]);

  return {
    balanceByMnv,
    yearData: live.yearData,
    loading: liveEnabled ? live.yearLoading : false,
    balanceEnhancing,
  };
}
