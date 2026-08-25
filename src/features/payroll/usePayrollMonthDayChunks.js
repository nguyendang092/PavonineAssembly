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
  collectAffectedRowIdsFromPatchedChunk,
  countPayrollMonthErrorDays,
  fetchOneDayWithRetry,
  fetchPayrollMonthDayChunks,
  insertChunkSortedByDate,
  stampPayrollMonthChunkAttendanceRootFlags,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  buildPayrollMonthDayChunkFromRaw,
  patchPayrollMonthDayRawInMemory,
} from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildPayrollMonthCacheKey,
  getCachedMonth,
  setCachedMonth,
} from "@/features/payroll/payrollMonthCache";
import {
  PAYROLL_MONTH_PREFETCH_BATCH_SIZE,
  PAYROLL_MONTH_PREFETCH_IDLE_TIMEOUT_MS,
  resolvePayrollMonthFetchBatchSize,
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
  const [monthLoadToken, setMonthLoadToken] = useState(0);
  const loadSeqRef = useRef(0);
  const abortControllerRef = useRef(null);
  const dayChunksRef = useRef([]);
  const loadMonthRef = useRef(async () => {});

  dayChunksRef.current = dayChunks;

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const displayDayChunks = useDeferredValue(dayChunks);
  const isDisplayStale = dayChunks !== displayDayChunks;
  const isGridBusy = loading || loadingMore || isDisplayStale;
  const errorDayCount = countPayrollMonthErrorDays(dayChunks);
  const cacheKey = buildPayrollMonthCacheKey(attendanceRootPath, monthKeys);

  const patchDay = useCallback(
    async (dateKey, options = {}) => {
      if (!dateKey) return { success: false, affectedRowIds: [], dateKey: "" };

      const {
        dayRaw = null,
        firebaseKey = "",
        persistedNode = null,
        affectedRowIds: hintRowIds = null,
        fallbackOnError = true,
      } = options ?? {};

      const mySeq = loadSeqRef.current;
      const started = performance.now();
      let usedLocalRaw = false;

      const commitChunk = (chunk) => {
        if (loadSeqRef.current !== mySeq) return [];
        let affectedRowIds = Array.isArray(hintRowIds)
          ? hintRowIds.filter(Boolean)
          : [];

        if (!affectedRowIds.length) {
          const tempNext = insertChunkSortedByDate(dayChunksRef.current, chunk);
          applyPayrollMonthCanonicalKeysToChunks(tempNext, { onlyDateKey: dateKey });
          const patched = tempNext.find((c) => c?.dateKey === dateKey);
          if (patched) {
            affectedRowIds = collectAffectedRowIdsFromPatchedChunk(
              patched,
              firebaseKey,
            );
          }
        }

        startTransition(() => {
          setDayChunks((prev) => {
            const next = insertChunkSortedByDate(prev, chunk);
            applyPayrollMonthCanonicalKeysToChunks(next, { onlyDateKey: dateKey });
            setCachedMonth(cacheKey, next);
            return next;
          });
        });

        return affectedRowIds;
      };

      try {
        let chunk = null;

        if (dayRaw != null) {
          chunk = stampPayrollMonthChunkAttendanceRootFlags(
            buildPayrollMonthDayChunkFromRaw(dayRaw, dateKey),
            attendanceRootPath,
          );
          usedLocalRaw = true;
        } else {
          const existing = dayChunksRef.current.find(
            (c) => c?.dateKey === dateKey,
          );
          const patchedRaw =
            firebaseKey && persistedNode != null
              ? patchPayrollMonthDayRawInMemory(
                  existing,
                  firebaseKey,
                  persistedNode,
                )
              : null;
          if (patchedRaw) {
            chunk = stampPayrollMonthChunkAttendanceRootFlags(
              buildPayrollMonthDayChunkFromRaw(patchedRaw, dateKey),
              attendanceRootPath,
            );
            usedLocalRaw = true;
          } else {
            chunk = await fetchOneDayWithRetry(attendanceRootPath, dateKey);
          }
        }

        if (loadSeqRef.current !== mySeq) {
          return { success: false, affectedRowIds: [], dateKey };
        }

        if (!chunk || chunk.status === "error") {
          throw new Error(chunk?.errorMessage || "patch failed");
        }

        const affectedRowIds = commitChunk(chunk);

        trackDayPatch({
          dateKey,
          durationMs: Math.round(performance.now() - started),
          success: true,
          local: usedLocalRaw,
          fetchCount: usedLocalRaw ? 0 : 1,
        });

        return { success: true, affectedRowIds, dateKey };
      } catch (err) {
        trackDayPatch({
          dateKey,
          durationMs: Math.round(performance.now() - started),
          success: false,
          local: usedLocalRaw,
        });

        if (fallbackOnError) {
          await loadMonthRef.current({ force: true });
        } else {
          setError(
            tlPage(errorMessageKey, "Không tải được dữ liệu: {{error}}", {
              error: err?.message || String(err),
            }),
          );
        }

        return { success: false, affectedRowIds: [], dateKey };
      }
    },
    [attendanceRootPath, cacheKey, errorMessageKey, tlPage],
  );

  const patchDays = useCallback(
    async (dateKeys, options = {}) => {
      const keys = Array.isArray(dateKeys) ? dateKeys : [dateKeys];
      const results = [];
      for (const dk of keys) {
        if (dk) results.push(await patchDay(dk, options));
      }
      return results;
    },
    [patchDay],
  );

  const loadMonth = useCallback(async (options = {}) => {
    const force = Boolean(options?.force);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentLoadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = currentLoadSeq;
    setError("");

    const cached = getCachedMonth(cacheKey);
    const started = performance.now();
    const batchSize = resolvePayrollMonthFetchBatchSize(monthKeys.length);
    const batchCount = Math.ceil((monthKeys.length || 1) / batchSize);

    if (cached?.dayChunks?.length) {
      startTransition(() => {
        setDayChunks(cached.dayChunks);
        setMonthLoadToken((t) => t + 1);
        setLoading(false);
        setLoadingMore(false);
      });
      if (cached.isFresh && !force) {
        trackMonthLoad({
          monthKey: cacheKey,
          attendanceRootPath,
          durationMs: Math.round(performance.now() - started),
          dayCount: cached.dayChunks.length,
          cacheHit: true,
          cacheFresh: true,
          revalidate: false,
          fetchCount: 0,
          batchSize,
          batchCount: 0,
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
        batchSize,
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
            setLoadingMore(i + batchSize < total);
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
        setMonthLoadToken((t) => t + 1);
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
        cacheFresh: Boolean(cached?.isFresh && !force),
        revalidate: Boolean(cached?.dayChunks?.length || force),
        fetchCount: monthKeys.length,
        batchSize,
        batchCount,
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

  loadMonthRef.current = loadMonth;

  useEffect(() => {
    if (
      !enablePrefetch ||
      !monthKeys?.length ||
      !shouldAllowPrefetch() ||
      loading ||
      loadingMore ||
      isRevalidating ||
      !displayDayChunks.length
    ) {
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
      idleId = requestIdleCallback(run, {
        timeout: PAYROLL_MONTH_PREFETCH_IDLE_TIMEOUT_MS,
      });
    } else {
      idleId = setTimeout(run, 2000);
    }

    return () => {
      controller.abort();
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, [
    enablePrefetch,
    loading,
    loadingMore,
    isRevalidating,
    displayDayChunks.length,
    monthKeys,
    attendanceRootPath,
  ]);

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
    monthLoadToken,
    cacheKey,
  };
}
