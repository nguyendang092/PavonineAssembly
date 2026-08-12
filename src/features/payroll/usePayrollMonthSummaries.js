import {
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { computePayrollMonthSummariesForIds } from "@/features/payroll/payrollMonthSummaryCompute";
import {
  PAYROLL_MONTH_SUMMARY_MAIN_BATCH_SIZE,
  PAYROLL_MONTH_SUMMARY_PROGRESS_STEP,
} from "@/features/payroll/payrollMonthDataScale";

/**
 * Tổng hợp tháng (`buildMonthlyRuleSummary`) — cache + batch / Web Worker khi nhiều NV.
 */
export function usePayrollMonthSummaries({
  enabled = true,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
}) {
  const [monthlySummaryById, setMonthlySummaryById] = useState(
    () => new Map(),
  );
  const [isSummariesBusy, setIsSummariesBusy] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(null);
  const cacheRef = useRef(new Map());
  const jobRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setIsSummariesBusy(false);
      setSummaryProgress(null);
      return;
    }

    const job = ++jobRef.current;
    const ids = filteredIds ?? [];

    if (!ids.length) {
      setMonthlySummaryById(new Map());
      setIsSummariesBusy(false);
      setSummaryProgress(null);
      return;
    }

    setIsSummariesBusy(true);
    setSummaryProgress({ done: 0, total: ids.length });

    void computePayrollMonthSummariesForIds({
      monthKeys,
      chunkByDate,
      ids,
      repById,
      cache: cacheRef.current,
      isStale: () => job !== jobRef.current,
      onProgress: (partialMap, done, total) => {
        if (job !== jobRef.current) return;
        const isFinal = done >= total;
        if (
          !isFinal &&
          done % PAYROLL_MONTH_SUMMARY_PROGRESS_STEP !== 0 &&
          done % PAYROLL_MONTH_SUMMARY_MAIN_BATCH_SIZE !== 0
        ) {
          return;
        }
        startTransition(() => {
          setMonthlySummaryById(new Map(partialMap));
          setSummaryProgress({ done, total });
        });
      },
    }).then((result) => {
      if (job !== jobRef.current || result == null) return;
      startTransition(() => {
        setMonthlySummaryById(result);
        setIsSummariesBusy(false);
        setSummaryProgress(null);
      });
    });
  }, [enabled, filteredIds, monthKeys, chunkByDate, repById]);

  return {
    monthlySummaryById,
    isSummariesBusy,
    summaryProgress,
    summaryCacheRef: cacheRef,
  };
}
