import { useMemo } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { resolveAnnualLeaveYearAsOfDateKey } from "./annualLeaveCalculated";
import {
  buildLiveAnnualLeaveBalanceByMnv,
  buildStoredAnnualLeaveBalanceByMnv,
} from "./annualLeaveDerived";
import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";

function normalizeScopeEmpKeys(scopeEmpKeys) {
  if (!Array.isArray(scopeEmpKeys)) return null;
  const set = new Set(scopeEmpKeys.filter(Boolean));
  return set.size > 0 ? set : null;
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
 * Map `emp_{mnv}` → BALANCE cho cột điểm danh / giờ công.
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

  const live = useAnnualLeaveLiveData(year, {
    enabled: liveEnabled,
    attendanceRootPath,
    throughDateKey,
    yearMonthPrefix,
    includeAttendance: true,
    includePayrollMonthAccrual: true,
    scopeEmpKeySet,
    ...rest,
  });

  const accrualAsOfDateKey = useMemo(
    () => resolveAnnualLeaveYearAsOfDateKey(year),
    [year],
  );

  const balanceByMnv = useMemo(() => {
    if (!liveEnabled || !live.yearData) return {};

    const stored = pickScopedBalanceMap(
      buildStoredAnnualLeaveBalanceByMnv(live.yearData),
      scopeEmpKeySet,
    );
    if (!live.attendanceDerivedReady) return stored;

    const monthSummaries = live.accrualDerivedReady
      ? live.monthWorkSummaryByEmpKey
      : {};

    return pickScopedBalanceMap(
      {
        ...stored,
        ...buildLiveAnnualLeaveBalanceByMnv(
          live.yearData,
          live.deductionsByEmpKey,
          year,
          {},
          live.attendanceMonthlyByEmpKey,
          monthSummaries,
          {
            scopeEmpKeySet,
            asOfDateKey: accrualAsOfDateKey,
          },
        ),
      },
      scopeEmpKeySet,
    );
  }, [
    liveEnabled,
    live.yearData,
    live.attendanceDerivedReady,
    live.accrualDerivedReady,
    live.deductionsByEmpKey,
    live.attendanceMonthlyByEmpKey,
    live.monthWorkSummaryByEmpKey,
    accrualAsOfDateKey,
    year,
    scopeEmpKeySet,
  ]);

  const balanceEnhancing =
    liveEnabled &&
    (live.yearLoading ||
      live.attendanceEnhancing ||
      live.payrollEnhancing ||
      (live.attendanceDerivedReady && !live.accrualDerivedReady));

  return {
    balanceByMnv,
    yearData: live.yearData,
    loading: liveEnabled ? live.yearLoading : false,
    balanceEnhancing,
  };
}
