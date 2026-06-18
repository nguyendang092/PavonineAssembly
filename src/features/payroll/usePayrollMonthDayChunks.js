import {
  useCallback,
  useDeferredValue,
  useRef,
  useState,
  startTransition,
} from "react";
import { fetchPayrollMonthDayChunks } from "@/features/payroll/payrollMonthlyGridData";
import {
  PAYROLL_MONTH_FETCH_BATCH_SIZE,
} from "@/features/payroll/payrollMonthDataScale";

/**
 * Tải `attendance/{ngày}` cả tháng — batch + `startTransition` + `useDeferredValue`
 * để render lưới không giật khi cập nhật từng batch.
 */
export function usePayrollMonthDayChunks({
  monthKeys,
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
  }, [monthKeys, tlPage, emptyMessageKey, emptyMessageDefault, errorMessageKey]);

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
