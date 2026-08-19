/** Cache in-memory lưới tháng — stale-while-revalidate. */

export const PAYROLL_MONTH_CACHE_TTL_MS = 90_000;
const PAYROLL_MONTH_CACHE_MAX_ENTRIES = 6;

const monthCache = new Map();

export function buildPayrollMonthCacheKey(attendanceRootPath, monthKeys) {
  const monthKey = String(monthKeys?.[0] ?? "").slice(0, 7);
  return `${attendanceRootPath ?? "attendance"}::${monthKey}`;
}

export function getCachedMonth(cacheKey) {
  const entry = monthCache.get(cacheKey);
  if (!entry) return null;
  return {
    dayChunks: entry.dayChunks,
    isFresh: Date.now() - entry.fetchedAt < PAYROLL_MONTH_CACHE_TTL_MS,
  };
}

export function setCachedMonth(cacheKey, dayChunks) {
  if (!cacheKey) return;
  monthCache.set(cacheKey, { dayChunks, fetchedAt: Date.now() });
  if (monthCache.size <= PAYROLL_MONTH_CACHE_MAX_ENTRIES) return;
  const oldestKey = [...monthCache.entries()].sort(
    (a, b) => a[1].fetchedAt - b[1].fetchedAt,
  )[0]?.[0];
  if (oldestKey) monthCache.delete(oldestKey);
}
