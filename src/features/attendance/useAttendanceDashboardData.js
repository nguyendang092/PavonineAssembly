import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { db, ref, get } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "@/hooks/firebaseGeneration";
import {
  buildAttendanceDashboardCacheKey,
  DASHBOARD_QUERY_CACHE_TTL_MS,
  getCached,
  invalidateCached,
  setCached,
} from "@/utils/queryCache";
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

async function fetchDashboardDayRow(attendanceRootPath, dateKey, sessionCache) {
  const sessionKey = `${attendanceRootPath}/${dateKey}`;
  if (sessionCache.has(sessionKey)) return sessionCache.get(sessionKey);

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
  sessionCache.set(sessionKey, row);
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

function summarizeDashboardRows(rows, normalizedPeriod, anchorDateKey) {
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
  return { offDayCount: off, holidayCount: hol };
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
  const cacheKey = buildAttendanceDashboardCacheKey(
    attendanceRootPath,
    anchorDateKey,
    normalizedPeriod,
  );
  const cachedInit = getCached(cacheKey, DASHBOARD_QUERY_CACHE_TTL_MS);

  const [loading, setLoading] = useState(() => !cachedInit?.data);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [dayResults, setDayResults] = useState(
    () => cachedInit?.data?.dayResults ?? [],
  );
  const [offDayCount, setOffDayCount] = useState(
    () => cachedInit?.data?.offDayCount ?? 0,
  );
  const [holidayCount, setHolidayCount] = useState(
    () => cachedInit?.data?.holidayCount ?? 0,
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const dayCacheRef = useRef(new Map());
  const fetchGenerationRef = useRef(0);

  const refresh = useCallback(() => {
    invalidateCached(cacheKey);
    setRefreshToken((token) => token + 1);
  }, [cacheKey]);

  const periodRange = useMemo(
    () => getDashboardPeriodRange(normalizedPeriod, anchorDateKey),
    [normalizedPeriod, anchorDateKey],
  );

  const periodDateKeys = useMemo(
    () => listDashboardPeriodDateKeys(normalizedPeriod, anchorDateKey),
    [normalizedPeriod, anchorDateKey],
  );

  useEffect(() => {
    const myGeneration = bumpFirebaseGeneration(fetchGenerationRef);
    const fetchKeys = listDashboardFetchDateKeys(
      normalizedPeriod,
      anchorDateKey,
    );
    const sessionCache = dayCacheRef.current;
    const cached = getCached(cacheKey, DASHBOARD_QUERY_CACHE_TTL_MS);

    if (cached?.data?.dayResults?.length) {
      setDayResults(cached.data.dayResults);
      setOffDayCount(cached.data.offDayCount ?? 0);
      setHolidayCount(cached.data.holidayCount ?? 0);
      if (cached.isFresh) {
        setLoading(false);
        setIsRevalidating(false);
        return undefined;
      }
      setLoading(false);
      setIsRevalidating(true);
    } else {
      setLoading(true);
      setDayResults([]);
      setOffDayCount(0);
      setHolidayCount(0);
      setIsRevalidating(false);
    }

    void (async () => {
      const rows = [];
      try {
        for (let i = 0; i < fetchKeys.length; i += DASHBOARD_FETCH_BATCH_SIZE) {
          if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
          const batchKeys = fetchKeys.slice(i, i + DASHBOARD_FETCH_BATCH_SIZE);
          const batchRows = await Promise.all(
            batchKeys.map((dateKey) =>
              fetchDashboardDayRow(attendanceRootPath, dateKey, sessionCache),
            ),
          );
          if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
          rows.push(...batchRows);
          startTransition(() => {
            if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
            setDayResults([...rows]);
          });
          if (i + DASHBOARD_FETCH_BATCH_SIZE < fetchKeys.length) {
            await waitAnimationFrame();
          }
        }

        if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
        const summary = summarizeDashboardRows(
          rows,
          normalizedPeriod,
          anchorDateKey,
        );
        setCached(cacheKey, {
          dayResults: rows,
          offDayCount: summary.offDayCount,
          holidayCount: summary.holidayCount,
        });
        startTransition(() => {
          if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
          setOffDayCount(summary.offDayCount);
          setHolidayCount(summary.holidayCount);
        });
      } finally {
        if (!isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) {
          setLoading(false);
          setIsRevalidating(false);
        }
      }
    })();

    return undefined;
  }, [
    attendanceRootPath,
    anchorDateKey,
    cacheKey,
    normalizedPeriod,
    refreshToken,
  ]);

  const periodDayResults = useMemo(
    () => dayResults.filter((row) => periodDateKeys.includes(row.dateKey)),
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
    isRevalidating,
    refresh,
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
