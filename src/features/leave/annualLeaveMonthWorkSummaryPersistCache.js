import { PAYROLL_MONTH_CACHE_TTL_MS } from "@/features/payroll/payrollMonthCache";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";
import { buildAnnualLeaveMonthWorkSummaryForEmpKey } from "./annualLeavePayrollAccrual";

/** @type {Map<string, { fetchedAt: number, byEmpKey: Record<string, object | null> }>} */
const buckets = new Map();

export function buildAnnualLeaveMonthWorkSummaryPersistCacheKey(
  year,
  attendanceRootPath = "attendance",
) {
  return `${attendanceRootPath ?? "attendance"}:${year}`;
}

function isBucketFresh(entry) {
  return (
    entry != null && Date.now() - entry.fetchedAt < PAYROLL_MONTH_CACHE_TTL_MS
  );
}

function getOrResetBucket(cacheKey) {
  const existing = buckets.get(cacheKey);
  if (isBucketFresh(existing)) return existing;

  const entry = { fetchedAt: Date.now(), byEmpKey: {} };
  buckets.set(cacheKey, entry);
  return entry;
}

/**
 * Xóa cache lưới giờ công cho persist phép năm.
 * @param {{ year?: number|string, attendanceRootPath?: string, empKeys?: string[]|null }} params
 */
export function invalidateAnnualLeaveMonthWorkSummaryPersistCache({
  year = null,
  attendanceRootPath = "attendance",
  empKeys = null,
} = {}) {
  if (year == null) {
    buckets.clear();
    return;
  }

  const cacheKey = buildAnnualLeaveMonthWorkSummaryPersistCacheKey(
    year,
    attendanceRootPath,
  );
  const entry = buckets.get(cacheKey);
  if (!entry) return;

  if (Array.isArray(empKeys) && empKeys.length > 0) {
    for (const empKey of empKeys) {
      if (empKey) delete entry.byEmpKey[empKey];
    }
    entry.fetchedAt = 0;
    return;
  }

  buckets.delete(cacheKey);
}

export function clearAnnualLeaveMonthWorkSummaryPersistCache() {
  buckets.clear();
}

function pickScopedSummaries(byEmpKey, scopeEmpKeySet) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    const map = {};
    for (const [empKey, summary] of Object.entries(byEmpKey)) {
      if (summary) map[empKey] = summary;
    }
    return map;
  }

  const scoped = {};
  for (const empKey of scopeEmpKeySet) {
    const summary = byEmpKey[empKey];
    if (summary) scoped[empKey] = summary;
  }
  return scoped;
}

/**
 * Cache `buildAnnualLeaveMonthWorkSummaryByEmpKey` theo `{year}` — TTL 5 phút,
 * chỉ build empKey chưa có trong bucket (cùng phiên persist liên tiếp).
 */
export function getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
  attendanceRoot,
  year,
  yearData,
  { attendanceRootPath = "attendance", scopeEmpKeySet = null } = {},
) {
  if (!attendanceRoot || !yearData || typeof yearData !== "object") {
    return {};
  }

  const cacheKey = buildAnnualLeaveMonthWorkSummaryPersistCacheKey(
    year,
    attendanceRootPath,
  );
  const bucket = getOrResetBucket(cacheKey);
  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const targetEmpKeys =
    scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0
      ? [...scopeEmpKeySet].filter((empKey) => indexed[empKey])
      : Object.keys(indexed);

  for (const empKey of targetEmpKeys) {
    if (Object.prototype.hasOwnProperty.call(bucket.byEmpKey, empKey)) {
      continue;
    }

    const summary = buildAnnualLeaveMonthWorkSummaryForEmpKey(
      attendanceRoot,
      year,
      yearData,
      empKey,
      { attendanceRootPath },
    );
    bucket.byEmpKey[empKey] =
      summary && Object.keys(summary).length ? summary : null;
  }

  return pickScopedSummaries(bucket.byEmpKey, scopeEmpKeySet);
}
