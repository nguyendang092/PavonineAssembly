import { persistSingleEmployeeAnnualLeaveFromAttendance } from "./annualLeaveAttendanceSync";

/** @type {Map<string, object>} */
const pendingByKey = new Map();
let flushTimer = null;
let flushChain = Promise.resolve();

const FLUSH_DELAY_MS = 450;

function queueKey({ year, empKey }) {
  return `${year}:${empKey}`;
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushChain = flushChain.then(() => flushPendingAnnualLeavePersists());
  }, FLUSH_DELAY_MS);
}

async function flushPendingAnnualLeavePersists() {
  if (pendingByKey.size === 0) return;

  const batch = [...pendingByKey.values()];
  pendingByKey.clear();

  for (const params of batch) {
    try {
      await persistSingleEmployeeAnnualLeaveFromAttendance(params.db, params);
    } catch (error) {
      console.error("annualLeavePersistQueue flush failed", error);
    }
  }
}

/**
 * Debounce ghi phép năm 1 NV — gom sửa điểm danh liên tiếp.
 */
export function queueSingleEmployeeAnnualLeavePersist(db, params) {
  const key = queueKey(params);
  pendingByKey.set(key, { db, ...params });
  scheduleFlush();
  return flushChain;
}
