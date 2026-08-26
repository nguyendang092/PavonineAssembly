/** Cache in-memory liên trang — stale-while-revalidate cho dashboard get() one-shot. */

export const DASHBOARD_QUERY_CACHE_TTL_MS = 3 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 48;

/** @type {Map<string, { data: unknown, ts: number }>} */
const cache = new Map();

/**
 * @param {string|null|undefined} key
 * @param {number} [ttlMs]
 * @returns {{ data: unknown, ts: number, ageMs: number, isFresh: boolean } | null}
 */
export function getCached(key, ttlMs = DASHBOARD_QUERY_CACHE_TTL_MS) {
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  const ageMs = Date.now() - entry.ts;
  return {
    data: entry.data,
    ts: entry.ts,
    ageMs,
    isFresh: entry.ts > 0 && ageMs < ttlMs,
  };
}

/** @param {string|null|undefined} key @param {unknown} data */
export function setCached(key, data) {
  if (!key) return;
  cache.set(key, { data, ts: Date.now() });
  if (cache.size <= QUERY_CACHE_MAX_ENTRIES) return;
  const oldestKey = [...cache.entries()].sort(
    (a, b) => a[1].ts - b[1].ts,
  )[0]?.[0];
  if (oldestKey) cache.delete(oldestKey);
}

/** Đánh dấu stale — lần đọc tiếp theo vẫn trả data nhưng isFresh = false. */
export function invalidateCached(key) {
  if (!key) return;
  const entry = cache.get(key);
  if (!entry) return;
  entry.ts = 0;
}

export function clearQueryCache() {
  cache.clear();
}

export function buildAttendanceDashboardCacheKey(
  attendanceRootPath,
  anchorDateKey,
  period,
) {
  return `attendanceDashboard:${attendanceRootPath}:${anchorDateKey}:${period}`;
}

export function buildAttendanceDailyReportCacheKey(rootPath, dateKey) {
  return `attendanceDailyReport:${rootPath}:${dateKey}`;
}

export const WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY =
  "warehouseInventory:latestSnapshot";

export const PERFORMANCE_CHART_STORE_CACHE_KEY =
  "performanceChart:performanceData";
