/** Cache in-memory lưới tháng — stale-while-revalidate. */

export const PAYROLL_MONTH_CACHE_TTL_MS = 5 * 60 * 1000;
const PAYROLL_MONTH_CACHE_MAX_ENTRIES = 8;

const monthCache = new Map();

export function buildPayrollMonthCacheKey(attendanceRootPath, monthKeys) {
  const monthKey = String(monthKeys?.[0] ?? "").slice(0, 7);
  return `${attendanceRootPath ?? "attendance"}:${monthKey}`;
}

export function getCachedMonth(cacheKey) {
  const entry = monthCache.get(cacheKey);
  if (!entry?.dayChunks?.length) return null;
  const ageMs = Date.now() - entry.fetchedAt;
  return {
    dayChunks: entry.dayChunks,
    isFresh: ageMs < PAYROLL_MONTH_CACHE_TTL_MS,
    ageMs,
    fetchedAt: entry.fetchedAt,
  };
}

export function setCachedMonth(cacheKey, dayChunks, { fetchedAt = Date.now() } = {}) {
  if (!cacheKey) return;
  monthCache.set(cacheKey, { dayChunks, fetchedAt });
  if (monthCache.size <= PAYROLL_MONTH_CACHE_MAX_ENTRIES) return;
  const oldestKey = [...monthCache.entries()].sort(
    (a, b) => a[1].fetchedAt - b[1].fetchedAt,
  )[0]?.[0];
  if (oldestKey) monthCache.delete(oldestKey);
}

/** Đánh dấu cache cũ — lần loadMonth() tiếp theo vẫn hiển thị cache rồi revalidate. */
export function invalidatePayrollMonthCache(cacheKey) {
  const entry = monthCache.get(cacheKey);
  if (!entry) return;
  entry.fetchedAt = 0;
}

export function clearPayrollMonthCache() {
  monthCache.clear();
}
