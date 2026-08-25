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
 *
 * - `monthLoadToken`: tăng khi loadMonth hoàn tất → tính lại toàn bộ filteredIds
 * - `dirtyPatch`: { token, employeeIds } → chỉ merge summary NV bị ảnh hưởng (patch 1 ô)
 */
export function usePayrollMonthSummaries({
  enabled = true,
  monthKeys,
  chunkByDate,
  filteredIds,
  repById,
  monthLoadToken = 0,
  dirtyPatch = null,
}) {
  const [monthlySummaryById, setMonthlySummaryById] = useState(
    () => new Map(),
  );
  const [isSummariesBusy, setIsSummariesBusy] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(null);
  const cacheRef = useRef(new Map());
  const jobRef = useRef(0);
  const chunkByDateRef = useRef(chunkByDate);
  const repByIdRef = useRef(repById);
  chunkByDateRef.current = chunkByDate;
  repByIdRef.current = repById;

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
      chunkByDate: chunkByDateRef.current,
      ids,
      repById: repByIdRef.current,
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
  }, [enabled, monthLoadToken, filteredIds, monthKeys]);

  useEffect(() => {
    if (!enabled || !dirtyPatch?.employeeIds?.length) return undefined;

    const job = ++jobRef.current;
    const dirtySet = new Set(dirtyPatch.employeeIds);
    const ids = (filteredIds ?? []).filter((id) => dirtySet.has(id));
    if (!ids.length) return undefined;

    setIsSummariesBusy(true);

    void computePayrollMonthSummariesForIds({
      monthKeys,
      chunkByDate: chunkByDateRef.current,
      ids,
      repById: repByIdRef.current,
      cache: cacheRef.current,
      isStale: () => job !== jobRef.current,
    }).then((result) => {
      if (job !== jobRef.current || result == null) return;
      startTransition(() => {
        setMonthlySummaryById((prev) => {
          const next = new Map(prev);
          for (const [id, summary] of result) {
            next.set(id, summary);
          }
          return next;
        });
        setIsSummariesBusy(false);
        setSummaryProgress(null);
      });
    });

    return undefined;
  }, [enabled, dirtyPatch?.token, dirtyPatch?.employeeIds, filteredIds, monthKeys]);

  return {
    monthlySummaryById,
    isSummariesBusy,
    summaryProgress,
    summaryCacheRef: cacheRef,
  };
}
