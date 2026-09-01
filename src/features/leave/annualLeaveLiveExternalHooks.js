import { useMemo, useSyncExternalStore } from "react";
import { resolveAccrualYearMonthsAttendanceRange } from "./annualLeavePayrollAccrual";
import {
  getAnnualLeaveYearSnapshot,
  getAttendanceJoinMonthsSnapshot,
  getAttendanceYearSnapshot,
  getLeaveAggYearSnapshot,
  isAnnualLeaveYearSnapshotReady,
  isAttendanceJoinMonthsSnapshotReady,
  isAttendanceYearSnapshotReady,
  isLeaveAggYearSnapshotReady,
  subscribeAnnualLeaveYear,
  subscribeAttendanceJoinMonths,
  subscribeAttendanceYear,
  subscribeLeaveAggYear,
} from "./annualLeaveLiveStore";

export function useAnnualLeaveYearExternal(year, enabled = true) {
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

export function useAttendanceYearExternal(
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

export function useAttendanceJoinMonthsExternal(
  attendanceRootPath,
  year,
  yearMonths,
  skipJoinMonthAccrual,
) {
  const yearMonthsKey = yearMonths.join(",");
  const range = useMemo(
    () => resolveAccrualYearMonthsAttendanceRange(yearMonths),
    [yearMonths],
  );

  const subscribe = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) {
      return () => () => {};
    }
    return (onChange) =>
      subscribeAttendanceJoinMonths(
        attendanceRootPath,
        year,
        yearMonthsKey,
        range,
        onChange,
      );
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    range,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const getSnapshot = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) return () => null;
    return () =>
      getAttendanceJoinMonthsSnapshot(attendanceRootPath, year, yearMonthsKey);
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const getReady = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) return () => true;
    return () =>
      isAttendanceJoinMonthsSnapshotReady(
        attendanceRootPath,
        year,
        yearMonthsKey,
      );
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

export function useLeaveAggYearExternal(year, enabled = true) {
  const subscribe = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => () => {};
    }
    return (onChange) => subscribeLeaveAggYear(year, onChange);
  }, [year, enabled]);

  const getSnapshot = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => null;
    }
    return () => getLeaveAggYearSnapshot(year);
  }, [year, enabled]);

  const getReady = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => true;
    }
    return () => isLeaveAggYearSnapshotReady(year);
  }, [year, enabled]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}
