import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { db, ref, onValue } from "@/services/firebase";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import { fetchPayrollMonthDayChunks, stampPayrollMonthChunkAttendanceRootFlags } from "@/features/payroll/payrollMonthlyGridData";
import {
  PAYROLL_MONTH_FETCH_BATCH_SIZE,
} from "@/features/payroll/payrollMonthDataScale";

/**
 * Tải `{attendanceRootPath}/{ngày}` cả tháng — batch + `startTransition` + `useDeferredValue`
 * để render lưới không giật khi cập nhật từng batch.
 */
export function usePayrollMonthDayChunks({
  monthKeys,
  attendanceRootPath = "attendance",
  liveEnabled = false,
  tlPage,
  emptyMessageKey = "monthlyTimesheetEmpty",
  emptyMessageDefault = "Không có dữ liệu điểm danh nào trong tháng này.",
  errorMessageKey = "monthlyTimesheetError",
}) {
  const [dayChunks, setDayChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadSeqRef = useRef(0);

  const displayDayChunks = useDeferredValue(dayChunks);
  const isDisplayStale = dayChunks !== displayDayChunks;
  const isGridBusy = loading || loadingMore || isDisplayStale;

  const loadMonth = useCallback(async () => {
    const currentLoadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = currentLoadSeq;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setDayChunks([]);

    try {
      const allChunks = await fetchPayrollMonthDayChunks(monthKeys, {
        attendanceRootPath,
        isStale: () => loadSeqRef.current !== currentLoadSeq,
        onFirstBatch: (chunks) => {
          startTransition(() => {
            setDayChunks(chunks);
            setLoading(false);
          });
        },
        onAfterBatch: (i, total, chunks) => {
          startTransition(() => {
            setDayChunks(chunks);
            setLoadingMore(
              i + PAYROLL_MONTH_FETCH_BATCH_SIZE < total,
            );
          });
        },
      });

      if (loadSeqRef.current !== currentLoadSeq || allChunks == null) return;

      startTransition(() => {
        setDayChunks(allChunks);
        if (!allChunks.length) {
          setError(
            tlPage(emptyMessageKey, emptyMessageDefault),
          );
        }
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
      }
    }
  }, [monthKeys, attendanceRootPath, tlPage, emptyMessageKey, emptyMessageDefault, errorMessageKey]);

  useEffect(() => {
    if (!liveEnabled || !monthKeys?.length) return;

    const unsubs = monthKeys.map((dateKey) =>
      onValue(ref(db, `${attendanceRootPath}/${dateKey}`), (snapshot) => {
        const chunk = stampPayrollMonthChunkAttendanceRootFlags(
          buildPayrollMonthDayChunkFromRaw(snapshot.val(), dateKey),
          attendanceRootPath,
        );
        if (!chunk) return;
        startTransition(() => {
          setDayChunks((prev) => {
            const byDate = new Map(prev.map((c) => [c.dateKey, c]));
            byDate.set(dateKey, chunk);
            return monthKeys.map((dk) => byDate.get(dk)).filter(Boolean);
          });
        });
      }),
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [liveEnabled, monthKeys, attendanceRootPath]);

  return {
    dayChunks,
    displayDayChunks,
    loading,
    loadingMore,
    isGridBusy,
    isDisplayStale,
    error,
    setError,
    loadMonth,
  };
}
