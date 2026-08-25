import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import { payrollEmployeeProfileDatesFingerprint } from "@/features/payroll/payrollEmployeeFields";
import {
  isPayrollMonthChunkFetchError,
  resolvePayrollMonthEmployeeProfileForSummary,
  computePayrollMonthEmployeeFingerprint,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  PAYROLL_MONTH_SUMMARY_CACHE_MAX,
  PAYROLL_MONTH_SUMMARY_MAIN_BATCH_SIZE,
  PAYROLL_MONTH_SUMMARY_PROGRESS_STEP,
  PAYROLL_MONTH_SUMMARY_SYNC_MAX_IDS,
  shouldUsePayrollMonthSummaryWorker,
} from "@/features/payroll/payrollMonthDataScale";
import {
  serializePayrollMonthChunkForWorker,
} from "@/features/payroll/payrollMonthChunkSerialize";

function schedulerYield(ms = 0) {
  return new Promise((resolve) => {
    if (ms > 0) setTimeout(resolve, ms);
    else if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 120 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function trimSummaryCache(cache, maxSize) {
  if (cache.size <= maxSize) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey != null) cache.delete(oldestKey);
}

function cacheKey(id, fingerprint, profileFingerprint) {
  return `${id}\0${fingerprint}\0${profileFingerprint}`;
}

function getCachedOrBuildMonthlySummary(
  cache,
  id,
  chunkByDate,
  monthKeys,
  employeeProfile,
) {
  const resolvedProfile = resolvePayrollMonthEmployeeProfileForSummary(
    chunkByDate,
    monthKeys,
    id,
    employeeProfile,
  );
  const profileFingerprint = payrollEmployeeProfileDatesFingerprint(
    resolvedProfile,
    monthKeys,
  );
  const contentFingerprint = computePayrollMonthEmployeeFingerprint(
    chunkByDate,
    monthKeys,
    id,
    employeeProfile,
  );
  const key = cacheKey(id, contentFingerprint, profileFingerprint);
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const summary = buildMonthlyRuleSummary(
    chunkByDate,
    monthKeys,
    id,
    resolvedProfile,
  );
  if (cache.size >= PAYROLL_MONTH_SUMMARY_CACHE_MAX) {
    trimSummaryCache(cache, PAYROLL_MONTH_SUMMARY_CACHE_MAX - 1);
  }
  cache.set(key, summary);
  return summary;
}

let summaryWorker = null;
let summaryWorkerJobId = 0;
const summaryWorkerPending = new Map();

function getSummaryWorker() {
  if (summaryWorker) return summaryWorker;
  if (typeof Worker === "undefined") return null;
  summaryWorker = new Worker(
    new URL("./payrollMonthSummaryWorker.js", import.meta.url),
    { type: "module" },
  );
  summaryWorker.onmessage = (event) => {
    const { jobId, results, error } = event.data ?? {};
    const pending = summaryWorkerPending.get(jobId);
    if (!pending) return;
    summaryWorkerPending.delete(jobId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(results ?? {});
  };
  summaryWorker.onerror = (err) => {
    for (const [, pending] of summaryWorkerPending) {
      pending.reject(err.error ?? new Error(String(err.message)));
    }
    summaryWorkerPending.clear();
    summaryWorker = null;
  };
  return summaryWorker;
}

function runSummariesInWorker({
  monthKeys,
  serializedChunks,
  ids,
  profilesById,
}) {
  const worker = getSummaryWorker();
  if (!worker) return null;
  const jobId = ++summaryWorkerJobId;
  return new Promise((resolve, reject) => {
    summaryWorkerPending.set(jobId, { resolve, reject });
    worker.postMessage({
      jobId,
      monthKeys,
      serializedChunks,
      ids,
      profilesById,
    });
  });
}

/**
 * Tính `buildMonthlyRuleSummary` cho danh sách NV — sync / batch / worker.
 * @returns {Promise<Map<string, object>>}
 */
export async function computePayrollMonthSummariesForIds({
  monthKeys,
  chunkByDate,
  ids,
  repById,
  cache,
  isStale,
  onProgress,
}) {
  const idList = ids ?? [];

  if (!idList.length) {
    return new Map();
  }

  const buildOne = (id) =>
    getCachedOrBuildMonthlySummary(
      cache,
      id,
      chunkByDate,
      monthKeys,
      repById?.get?.(id),
    );

  if (idList.length <= PAYROLL_MONTH_SUMMARY_SYNC_MAX_IDS) {
    const out = new Map();
    for (const id of idList) {
      if (isStale?.()) return null;
      out.set(id, buildOne(id));
    }
    onProgress?.(out, idList.length, idList.length);
    return out;
  }

  const profilesById = {};
  for (const id of idList) {
    const rep = repById?.get?.(id);
    if (rep) profilesById[id] = rep;
  }

  if (shouldUsePayrollMonthSummaryWorker(idList.length)) {
    const serializedChunks = [];
    for (const dk of monthKeys) {
      const ch = chunkByDate.get(dk);
      if (isPayrollMonthChunkFetchError(ch)) continue;
      const s = serializePayrollMonthChunkForWorker(ch);
      if (s) serializedChunks.push(s);
    }
    try {
      const workerResults = await runSummariesInWorker({
        monthKeys,
        serializedChunks,
        ids: idList,
        profilesById,
      });
      if (workerResults != null && !isStale?.()) {
        const out = new Map();
        for (const id of idList) {
          const summary = workerResults[id];
          if (summary) {
            const rep = repById?.get?.(id);
            const resolvedProfile = resolvePayrollMonthEmployeeProfileForSummary(
              chunkByDate,
              monthKeys,
              id,
              rep,
            );
            const profileFingerprint = payrollEmployeeProfileDatesFingerprint(
              resolvedProfile,
              monthKeys,
            );
            const contentFingerprint = computePayrollMonthEmployeeFingerprint(
              chunkByDate,
              monthKeys,
              id,
              rep,
            );
            const key = cacheKey(id, contentFingerprint, profileFingerprint);
            cache.set(key, summary);
            out.set(id, summary);
          }
        }
        trimSummaryCache(cache, PAYROLL_MONTH_SUMMARY_CACHE_MAX);
        onProgress?.(out, idList.length, idList.length);
        return out;
      }
    } catch {
      /* fallback batch trên main thread */
    }
  }

  const out = new Map();
  const batch = PAYROLL_MONTH_SUMMARY_MAIN_BATCH_SIZE;
  for (let i = 0; i < idList.length; i += batch) {
    if (isStale?.()) return null;
    const slice = idList.slice(i, i + batch);
    for (const id of slice) {
      out.set(id, buildOne(id));
    }
    onProgress?.(
      new Map(out),
      Math.min(i + batch, idList.length),
      idList.length,
    );
    await schedulerYield();
  }
  return out;
}
