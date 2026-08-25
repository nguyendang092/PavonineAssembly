/**
 * Ngưỡng / batch cho lưới tháng — chỉnh khi dữ liệu lớn.
 */
export const PAYROLL_MONTH_FETCH_BATCH_SIZE = 14;
export const PAYROLL_MONTH_PREFETCH_BATCH_SIZE = 7;
export const PAYROLL_MONTH_PREFETCH_IDLE_TIMEOUT_MS = 5000;

/** Số ngày mỗi batch fetch — tối đa PAYROLL_MONTH_FETCH_BATCH_SIZE. */
export function resolvePayrollMonthFetchBatchSize(dayCount) {
  const n = Math.max(1, Number(dayCount) || PAYROLL_MONTH_FETCH_BATCH_SIZE);
  return Math.min(PAYROLL_MONTH_FETCH_BATCH_SIZE, n);
}
export const PAYROLL_MONTH_FETCH_YIELD_MS = 0;
export const PAYROLL_MONTH_DAY_FETCH_MAX_RETRY = 2;
export const PAYROLL_MONTH_DAY_FETCH_BASE_DELAY_MS = 400;
/** Bật khi đã có Cloud Function ghi `attendanceMonthly/{monthKey}`. */
export const USE_MONTHLY_AGGREGATE_NODE = false;
/** Dưới ngưỡng này tính tổng hợp sync trên main thread (batch). */
export const PAYROLL_MONTH_SUMMARY_SYNC_MAX_IDS = 48;
export const PAYROLL_MONTH_SUMMARY_MAIN_BATCH_SIZE = 32;
export const PAYROLL_MONTH_SUMMARY_PROGRESS_STEP = 32;
export const PAYROLL_MONTH_SUMMARY_WORKER_THRESHOLD = 60;
export const PAYROLL_MONTH_SUMMARY_CACHE_MAX = 12000;

export function shouldUsePayrollMonthSummaryWorker(employeeCount) {
  return employeeCount >= PAYROLL_MONTH_SUMMARY_WORKER_THRESHOLD;
}
