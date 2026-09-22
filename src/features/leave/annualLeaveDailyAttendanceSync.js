import { get, ref, update } from "@/services/firebase";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import { persistAnnualLeaveMonthFromAttendance } from "./annualLeaveAttendanceSync";
import {
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";

export function annualLeaveYearMetaPath(year) {
  return `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${ANNUAL_LEAVE_META_KEY}`;
}

/**
 * Sau 00h: quét lại tháng của ngày hôm qua từ điểm danh (agg + phép năm).
 * Job Cloud Function `scheduledAnnualLeaveRecalculate` làm việc tương tự trên server;
 * đây là fallback khi mở trang Quản lý phép năm.
 */
export async function syncAnnualLeaveForLocalDayRollover(
  db,
  { todayKey, updatedBy = "" } = {},
) {
  const yesterdayKey = getDateKeyBySubtractDays(todayKey, 1);
  const year = Number(String(yesterdayKey).slice(0, 4));
  if (!Number.isFinite(year) || year < 2000) {
    return { skipped: true, reason: "invalid_year" };
  }

  const metaPath = annualLeaveYearMetaPath(year);
  const metaSnap = await get(ref(db, metaPath));
  if (!metaSnap.exists()) {
    return { skipped: true, reason: "no_year_meta", year };
  }

  const meta = metaSnap.val() ?? {};
  if (String(meta.lastAttendanceSyncDateKey ?? "") === String(todayKey)) {
    return { skipped: true, reason: "already_synced", year };
  }

  const result = await persistAnnualLeaveMonthFromAttendance(db, {
    year,
    dateKey: yesterdayKey,
    attendanceRootPath: "attendance",
    updatedBy,
    resyncAggFromMonth: true,
  });

  await update(ref(db, metaPath), {
    lastAttendanceSyncDateKey: todayKey,
    lastAttendanceSyncAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  });

  return {
    skipped: false,
    year,
    yesterdayKey,
    appliedCount: result?.appliedCount ?? 0,
  };
}
