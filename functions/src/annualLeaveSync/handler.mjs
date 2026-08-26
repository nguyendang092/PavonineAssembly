import {
  computeLoaiPhepDeductionDelta,
  shouldProcessAttendanceDateForLeave,
} from "./deduction.mjs";
import { applyLeaveAggDeductionDelta } from "./leaveAgg.mjs";
import { persistAnnualLeaveEmployeeFromAgg } from "./persistEmployee.mjs";

const ATTENDANCE_META_KEY = "_meta";

/**
 * Xử lý onWrite `attendance/{dateKey}/{empKey}` — delta loại phép → agg → annualLeave.
 * @param {import("firebase-admin/database").Database} db
 */
export async function handleAttendanceEmpAnnualLeaveSync(
  db,
  { dateKey, empKey, before, after },
) {
  if (!empKey || empKey === ATTENDANCE_META_KEY) {
    return { skipped: true, reason: "meta_or_empty_key" };
  }

  const year = Number(String(dateKey ?? "").slice(0, 4));
  if (!Number.isFinite(year) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
    return { skipped: true, reason: "invalid_date" };
  }

  if (!shouldProcessAttendanceDateForLeave(dateKey, year)) {
    return { skipped: true, reason: "out_of_leave_scope" };
  }

  const delta = computeLoaiPhepDeductionDelta(before, after);
  if (delta === 0) {
    return { skipped: true, reason: "no_delta", delta: 0 };
  }

  await applyLeaveAggDeductionDelta(db, {
    year,
    empKey,
    dateKey,
    delta,
  });

  const persistResult = await persistAnnualLeaveEmployeeFromAgg(db, {
    year,
    empKey,
  });

  return {
    applied: true,
    delta,
    persist: persistResult,
  };
}
