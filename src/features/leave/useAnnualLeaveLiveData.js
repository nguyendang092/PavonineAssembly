import { useMemo, useSyncExternalStore } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import {
  buildAttendanceAnnualLeaveDeductionsByMnv,
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
} from "./annualLeaveBalanceLookup";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import {
  getAnnualLeaveYearSnapshot,
  getAttendanceYearSnapshot,
  isAnnualLeaveYearSnapshotReady,
  isAttendanceYearSnapshotReady,
  subscribeAnnualLeaveYear,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";

function useAnnualLeaveYearExternal(year, enabled) {
  const subscribe = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => () => {};
    }
    return (onChange) => subscribeAnnualLeaveYear(year, onChange);
  }, [year, enabled]);

  const getSnapshot = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => null;
    }
    return () => getAnnualLeaveYearSnapshot(year);
  }, [year, enabled]);

  const getReady = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => true;
    }
    return () => isAnnualLeaveYearSnapshotReady(year);
  }, [year, enabled]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

function useAttendanceYearExternal(
  attendanceRootPath,
  year,
  skipAttendance,
  throughDateKey = null,
) {
  const subscribe = useMemo(() => {
    if (skipAttendance) return () => () => {};
    return (onChange) =>
      subscribeAttendanceYear(
        attendanceRootPath,
        year,
        onChange,
        throughDateKey,
      );
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const getSnapshot = useMemo(() => {
    if (skipAttendance) return () => null;
    return () =>
      getAttendanceYearSnapshot(attendanceRootPath, year, throughDateKey);
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const getReady = useMemo(() => {
    if (skipAttendance) return () => true;
    return () =>
      isAttendanceYearSnapshotReady(attendanceRootPath, year, throughDateKey);
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

/**
 * Dữ liệu phép năm live — một listener RTDB dùng chung (store) cho cả app.
 * - `throughDateKey`: lũy kế PN đến ngày này (điểm danh / lương).
 * - `yearMonthPrefix`: chỉ trong tháng.
 * - Không filter: cả kỳ trong năm (quản lý phép năm).
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
  } = {},
) {
  const skipAttendance = !enabled || shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);

  const { data: yearData, ready: yearReady } = useAnnualLeaveYearExternal(
    year,
    enabled,
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

  const deductionsByEmpKey = useMemo(
    () =>
      skipAttendance
        ? {}
        : buildAttendanceAnnualLeaveDeductionsByMnv(
            attendanceRoot,
            year,
            deductionFilter,
          ),
    [attendanceRoot, year, deductionFilter, skipAttendance],
  );

  const balanceByMnv = useMemo(
    () =>
      skipAttendance || !includeBalanceMap
        ? {}
        : buildLiveAnnualLeaveBalanceByMnv(yearData, deductionsByEmpKey),
    [yearData, deductionsByEmpKey, skipAttendance, includeBalanceMap],
  );

  const usageDetailByEmpKey = useMemo(
    () =>
      skipAttendance || !includeUsageDetail
        ? {}
        : buildAttendanceAnnualLeaveUsageDetailByEmpKey(
            attendanceRoot,
            year,
            deductionFilter,
          ),
    [
      attendanceRoot,
      year,
      deductionFilter,
      skipAttendance,
      includeUsageDetail,
    ],
  );

  const loading = !yearReady || (!skipAttendance && !attendanceReady);

  return {
    yearData,
    attendanceRoot: skipAttendance ? null : attendanceRoot,
    deductionsByEmpKey,
    balanceByMnv,
    usageDetailByEmpKey,
    loading,
    throughDateKey,
    yearMonthPrefix,
  };
}
