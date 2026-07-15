import { useEffect, useMemo, useState } from "react";
import { db, ref, get } from "@/services/firebase";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import { countAttendanceDashboardDaySummary } from "./attendanceDashboardMetrics";
import {
  buildDashboardTrendPoints,
  dedupeRosterEmployees,
  flattenPersonDayEmployees,
  formatDashboardPeriodLabel,
  getDashboardPeriodRange,
  listDashboardFetchDateKeys,
  listDashboardPeriodDateKeys,
  normalizeDashboardPeriod,
} from "./attendanceDashboardPeriod";
import {
  getIsHolidayDayFromRaw,
  getIsOffDayFromRaw,
} from "./attendanceDayMeta";

/**
 * Tải dữ liệu dashboard theo kỳ (ngày / tuần / tháng / năm).
 */
export function useAttendanceDashboardData(
  attendanceRootPath,
  anchorDateKey,
  period,
  locale = "vi-VN",
) {
  const normalizedPeriod = normalizeDashboardPeriod(period);
  const [loading, setLoading] = useState(false);
  const [dayResults, setDayResults] = useState([]);
  const [offDayCount, setOffDayCount] = useState(0);
  const [holidayCount, setHolidayCount] = useState(0);

  const periodRange = useMemo(
    () => getDashboardPeriodRange(normalizedPeriod, anchorDateKey),
    [normalizedPeriod, anchorDateKey],
  );

  const periodDateKeys = useMemo(
    () => listDashboardPeriodDateKeys(normalizedPeriod, anchorDateKey),
    [normalizedPeriod, anchorDateKey],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchKeys = listDashboardFetchDateKeys(
      normalizedPeriod,
      anchorDateKey,
    );

    setLoading(true);
    Promise.all(
      fetchKeys.map(async (dateKey) => {
        const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
        const raw = snap.val();
        const employees = reconcileAttendanceDayRowsFromRaw([], raw, {
          seasonal: attendanceRootPath === "seasonalAttendance",
        });
        const summary = countAttendanceDashboardDaySummary(employees);
        return {
          dateKey,
          employees,
          summary,
          isOffDay: getIsOffDayFromRaw(raw),
          isHolidayDay: getIsHolidayDayFromRaw(raw),
        };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        setDayResults(rows);
        const periodSet = new Set(
          listDashboardPeriodDateKeys(normalizedPeriod, anchorDateKey),
        );
        let off = 0;
        let hol = 0;
        for (const row of rows) {
          if (!periodSet.has(row.dateKey)) continue;
          if (row.isOffDay) off += 1;
          if (row.isHolidayDay) hol += 1;
        }
        setOffDayCount(off);
        setHolidayCount(hol);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attendanceRootPath, anchorDateKey, normalizedPeriod]);

  const periodDayResults = useMemo(
    () =>
      dayResults.filter((row) => periodDateKeys.includes(row.dateKey)),
    [dayResults, periodDateKeys],
  );

  const employees = useMemo(
    () => flattenPersonDayEmployees(periodDayResults),
    [periodDayResults],
  );

  const rosterEmployees = useMemo(
    () => dedupeRosterEmployees(periodDayResults),
    [periodDayResults],
  );

  const dailySummaries = useMemo(
    () =>
      dayResults.map((row) => ({
        dateKey: row.dateKey,
        ...row.summary,
      })),
    [dayResults],
  );

  const trendPoints = useMemo(
    () =>
      buildDashboardTrendPoints(
        normalizedPeriod,
        anchorDateKey,
        dailySummaries,
        locale,
      ),
    [normalizedPeriod, anchorDateKey, dailySummaries, locale],
  );

  const periodLabel = useMemo(
    () => formatDashboardPeriodLabel(normalizedPeriod, anchorDateKey, locale),
    [normalizedPeriod, anchorDateKey, locale],
  );

  return {
    loading,
    employees,
    rosterEmployees,
    trendPoints,
    periodRange,
    periodLabel,
    periodDayCount: periodDateKeys.length,
    isOffDay: offDayCount > 0,
    isHolidayDay: holidayCount > 0,
    offDayCount,
    holidayCount,
  };
}
