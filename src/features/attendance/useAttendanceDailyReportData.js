import { useCallback, useMemo } from "react";
import { useFirebaseOnce } from "@/hooks/useFirebaseOnce";
import { buildAttendanceDailyReportCacheKey } from "@/utils/queryCache";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import {
  getIsCompensatoryDayFromRaw,
  getIsHolidayDayFromRaw,
  getIsOffDayFromRaw,
} from "./attendanceDayMeta";

/**
 * Tải điểm danh ngày — cả 정규직 (`attendance`) và 일용직 (`seasonalAttendance`).
 */
export function useAttendanceDailyReportData(dateKey) {
  const regularPath = dateKey ? `attendance/${dateKey}` : null;
  const seasonalPath = dateKey ? `seasonalAttendance/${dateKey}` : null;

  const regularFetch = useFirebaseOnce(regularPath, [dateKey], {
    cacheKey: dateKey
      ? buildAttendanceDailyReportCacheKey("attendance", dateKey)
      : undefined,
  });
  const seasonalFetch = useFirebaseOnce(seasonalPath, [dateKey], {
    cacheKey: dateKey
      ? buildAttendanceDailyReportCacheKey("seasonalAttendance", dateKey)
      : undefined,
  });

  const loading =
    Boolean(dateKey) &&
    regularFetch.loading &&
    seasonalFetch.loading &&
    regularFetch.data === undefined &&
    seasonalFetch.data === undefined;
  const isRevalidating =
    Boolean(dateKey) &&
    (regularFetch.isRevalidating || seasonalFetch.isRevalidating);
  const error = regularFetch.error || seasonalFetch.error || "";

  const refresh = useCallback(() => {
    regularFetch.refresh();
    seasonalFetch.refresh();
  }, [regularFetch, seasonalFetch]);

  const regularEmployees = useMemo(
    () =>
      dateKey
        ? reconcileAttendanceDayRowsFromRaw([], regularFetch.data, {
            seasonal: false,
          })
        : [],
    [dateKey, regularFetch.data],
  );

  const seasonalEmployees = useMemo(
    () =>
      dateKey
        ? reconcileAttendanceDayRowsFromRaw([], seasonalFetch.data, {
            seasonal: true,
          })
        : [],
    [dateKey, seasonalFetch.data],
  );

  const dayMeta = useMemo(
    () => ({
      isOffDay: getIsOffDayFromRaw(regularFetch.data),
      isHolidayDay: getIsHolidayDayFromRaw(regularFetch.data),
      isCompensatoryDay: getIsCompensatoryDayFromRaw(regularFetch.data),
    }),
    [regularFetch.data],
  );

  return {
    loading,
    isRevalidating,
    refresh,
    error,
    regularEmployees: error ? [] : regularEmployees,
    seasonalEmployees: error ? [] : seasonalEmployees,
    dayMeta: error
      ? { isOffDay: false, isHolidayDay: false, isCompensatoryDay: false }
      : dayMeta,
  };
}
