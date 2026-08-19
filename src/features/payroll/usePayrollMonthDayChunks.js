import {

  useCallback,

  useDeferredValue,

  useEffect,

  useRef,

  useState,

  startTransition,

} from "react";

import {

  applyPayrollMonthCanonicalKeysToChunks,

  countPayrollMonthErrorDays,

  fetchOneDayWithRetry,

  fetchPayrollMonthDayChunks,

  insertChunkSortedByDate,

} from "@/features/payroll/payrollMonthlyGridData";

import {

  buildPayrollMonthCacheKey,

  getCachedMonth,

  setCachedMonth,

} from "@/features/payroll/payrollMonthCache";

import {

  PAYROLL_MONTH_FETCH_BATCH_SIZE,

  PAYROLL_MONTH_PREFETCH_BATCH_SIZE,

} from "@/features/payroll/payrollMonthDataScale";

import { trackDayPatch, trackMonthLoad } from "@/features/payroll/payrollMonthTelemetry";

import {

  enumerateDateKeysInclusive,

  getFirstDayOfMonthKey,

  getLastDayOfMonthKey,

  shiftMonthKey,

} from "@/utils/dateKey";



function shouldAllowPrefetch() {

  if (typeof navigator === "undefined") return true;

  const conn =

    navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;

  if (!conn) return true;
  if (conn.saveData) return false;

  const type = String(conn.effectiveType ?? "");

  return type !== "slow-2g" && type !== "2g";

}



function buildMonthKeysFromFirst(firstKey) {

  const first = getFirstDayOfMonthKey(firstKey);

  const last = getLastDayOfMonthKey(firstKey);

  return enumerateDateKeysInclusive(first, last);

}



function monthChunksHaveAttendanceData(chunks) {

  return (chunks ?? []).some(

    (c) =>

      (c?.employees?.length ?? 0) > 0 ||

      c?.isOffDay ||

      c?.isHolidayDay ||

      c?.isCompensatoryDay,

  );

}



function prefetchAdjacentMonths(monthKeys, attendanceRootPath, signal) {

  const firstKey = monthKeys[0];

  for (const delta of [-1, 1]) {

    const keys = buildMonthKeysFromFirst(shiftMonthKey(firstKey, delta));

    const adjCacheKey = buildPayrollMonthCacheKey(attendanceRootPath, keys);

    if (getCachedMonth(adjCacheKey)?.isFresh) continue;

    void fetchPayrollMonthDayChunks(keys, {

      attendanceRootPath,

      batchSize: PAYROLL_MONTH_PREFETCH_BATCH_SIZE,

      signal,

      isStale: () => signal.aborted,

    }).then((chunks) => {

      if (chunks?.length && !signal.aborted) {

        setCachedMonth(adjCacheKey, chunks);

      }

    });

  }

}



/**

 * Tải `{attendanceRootPath}/{ngày}` cả tháng — batch + cache SWR + patchDay incremental.

 */

export function usePayrollMonthDayChunks({

  monthKeys,

  attendanceRootPath = "attendance",

  tlPage,

  emptyMessageKey = "monthlyTimesheetEmpty",

  emptyMessageDefault = "Không có dữ liệu điểm danh nào trong tháng này.",

  errorMessageKey = "monthlyTimesheetError",

  enablePrefetch = true,

}) {

  const [dayChunks, setDayChunks] = useState([]);

  const [loading, setLoading] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);

  const [isRevalidating, setIsRevalidating] = useState(false);

  const [error, setError] = useState("");

  const loadSeqRef = useRef(0);

  const abortControllerRef = useRef(null);



  useEffect(() => () => abortControllerRef.current?.abort(), []);



  const displayDayChunks = useDeferredValue(dayChunks);

  const isDisplayStale = dayChunks !== displayDayChunks;

  const isGridBusy = loading || loadingMore || isDisplayStale;

  const errorDayCount = countPayrollMonthErrorDays(dayChunks);

  const cacheKey = buildPayrollMonthCacheKey(attendanceRootPath, monthKeys);



  const patchDay = useCallback(

    async (dateKey) => {

      if (!dateKey) return;

      const mySeq = loadSeqRef.current;

      const started = performance.now();

      try {

        const chunk = await fetchOneDayWithRetry(attendanceRootPath, dateKey);

        if (loadSeqRef.current !== mySeq) return;



        startTransition(() => {

          setDayChunks((prev) => {

            const next = insertChunkSortedByDate(prev, chunk);

            applyPayrollMonthCanonicalKeysToChunks(next, { onlyDateKey: dateKey });

            setCachedMonth(cacheKey, next);

            return next;

          });

        });

        trackDayPatch({

          dateKey,

          durationMs: Math.round(performance.now() - started),

          success: chunk?.status !== "error",

        });

      } catch (err) {

        trackDayPatch({

          dateKey,

          durationMs: Math.round(performance.now() - started),

          success: false,

        });

        setError(

          tlPage(errorMessageKey, "Không tải được dữ liệu: {{error}}", {

            error: err?.message || String(err),

          }),

        );

      }

    },

    [attendanceRootPath, cacheKey, errorMessageKey, tlPage],

  );



  const patchDays = useCallback(

    (dateKeys) => {

      for (const dk of Array.isArray(dateKeys) ? dateKeys : [dateKeys]) {

        if (dk) void patchDay(dk);

      }

    },

    [patchDay],

  );



  const loadMonth = useCallback(async () => {

    abortControllerRef.current?.abort();

    const controller = new AbortController();

    abortControllerRef.current = controller;



    const currentLoadSeq = loadSeqRef.current + 1;

    loadSeqRef.current = currentLoadSeq;

    setError("");



    const cached = getCachedMonth(cacheKey);

    const started = performance.now();



    if (cached?.dayChunks?.length) {

      startTransition(() => {

        setDayChunks(cached.dayChunks);

        setLoading(false);

        setLoadingMore(false);

      });

      if (cached.isFresh) {

        trackMonthLoad({

          monthKey: cacheKey,

          attendanceRootPath,

          durationMs: Math.round(performance.now() - started),

          dayCount: cached.dayChunks.length,

          cacheHit: true,

          errorDayCount: countPayrollMonthErrorDays(cached.dayChunks),

        });

        return;

      }

      setIsRevalidating(true);

    } else {

      setLoading(true);

      setLoadingMore(false);

      setDayChunks([]);

    }



    try {

      const allChunks = await fetchPayrollMonthDayChunks(monthKeys, {

        attendanceRootPath,

        signal: controller.signal,

        isStale: () =>

          loadSeqRef.current !== currentLoadSeq || controller.signal.aborted,

        onFirstBatch: (chunks) => {

          if (loadSeqRef.current !== currentLoadSeq) return;

          startTransition(() => {

            setDayChunks(chunks);

            setLoading(false);

          });

        },

        onAfterBatch: (i, total, chunks) => {

          if (loadSeqRef.current !== currentLoadSeq) return;

          startTransition(() => {

            setDayChunks(chunks);

            setLoadingMore(i + PAYROLL_MONTH_FETCH_BATCH_SIZE < total);

          });

        },

      });



      if (

        loadSeqRef.current !== currentLoadSeq ||

        allChunks == null ||

        controller.signal.aborted

      ) {

        return;

      }



      setCachedMonth(cacheKey, allChunks);

      startTransition(() => {

        setDayChunks(allChunks);

        if (!monthChunksHaveAttendanceData(allChunks)) {

          setError(tlPage(emptyMessageKey, emptyMessageDefault));

        }

      });



      trackMonthLoad({

        monthKey: cacheKey,

        attendanceRootPath,

        durationMs: Math.round(performance.now() - started),

        dayCount: allChunks.length,

        cacheHit: Boolean(cached?.dayChunks?.length),

        errorDayCount: countPayrollMonthErrorDays(allChunks),

      });

    } catch (e) {

      if (loadSeqRef.current !== currentLoadSeq) return;

      setError(

        tlPage(errorMessageKey, "Không tải được dữ liệu: {{error}}", {

          error: e?.message || String(e),

        }),

      );

    } finally {

      if (loadSeqRef.current === currentLoadSeq) {

        setLoading(false);

        setLoadingMore(false);

        setIsRevalidating(false);

      }

    }

  }, [

    monthKeys,

    attendanceRootPath,

    tlPage,

    emptyMessageKey,

    emptyMessageDefault,

    errorMessageKey,

    cacheKey,

  ]);



  useEffect(() => {

    if (!enablePrefetch || loading || !monthKeys?.length || !shouldAllowPrefetch()) {

      return undefined;

    }



    const controller = new AbortController();

    const run = () => {

      if (!controller.signal.aborted) {

        prefetchAdjacentMonths(monthKeys, attendanceRootPath, controller.signal);

      }

    };



    let idleId;

    if (typeof requestIdleCallback === "function") {

      idleId = requestIdleCallback(run, { timeout: 3000 });

    } else {

      idleId = setTimeout(run, 1500);

    }



    return () => {

      controller.abort();

      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {

        cancelIdleCallback(idleId);

      } else {

        clearTimeout(idleId);

      }

    };

  }, [enablePrefetch, loading, monthKeys, attendanceRootPath]);



  return {

    displayDayChunks,

    loading,

    loadingMore,

    isRevalidating,

    isGridBusy,

    isDisplayStale,

    errorDayCount,

    error,

    setError,

    loadMonth,

    patchDay,

    patchDays,

  };

}


