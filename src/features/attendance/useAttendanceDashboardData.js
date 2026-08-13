import { useEffect, useMemo, useRef, useState, startTransition } from "react";
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

const DASHBOARD_FETCH_BATCH_SIZE = 7;

async function fetchDashboardDayRow(attendanceRootPath, dateKey, cache) {
  const cacheKey = `${attendanceRootPath}/${dateKey}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
  const raw = snap.val();
  const employees = reconcileAttendanceDayRowsFromRaw([], raw, {
    seasonal: attendanceRootPath === "seasonalAttendance",
  });
  const summary = countAttendanceDashboardDaySummary(employees);
  const row = {
    dateKey,
    employees,
    summary,
    isOffDay: getIsOffDayFromRaw(raw),
    isHolidayDay: getIsHolidayDayFromRaw(raw),
  };
  cache.set(cacheKey, row);
  return row;
}

function waitAnimationFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    resolve();
  });
}

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
  const dayCacheRef = useRef(new Map());

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
    const cache = dayCacheRef.current;

    setLoading(true);
    setDayResults([]);

    void (async () => {
      const rows = [];
      try {
        for (let i = 0; i < fetchKeys.length; i += DASHBOARD_FETCH_BATCH_SIZE) {
          if (cancelled) return;
          const batchKeys = fetchKeys.slice(i, i + DASHBOARD_FETCH_BATCH_SIZE);
          const batchRows = await Promise.all(
            batchKeys.map((dateKey) =>
              fetchDashboardDayRow(attendanceRootPath, dateKey, cache),
            ),
          );
          rows.push(...batchRows);
          startTransition(() => {
            if (cancelled) return;
            setDayResults([...rows]);
          });
          if (i + DASHBOARD_FETCH_BATCH_SIZE < fetchKeys.length) {
            await waitAnimationFrame();
          }
        }

        if (cancelled) return;
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
        startTransition(() => {
          if (cancelled) return;
          setOffDayCount(off);
          setHolidayCount(hol);
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

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
