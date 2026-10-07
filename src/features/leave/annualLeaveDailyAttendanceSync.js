import { get, ref } from "@/services/firebase";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import { persistAnnualLeaveMonthFromAttendance } from "./annualLeaveAttendanceSync";
import { collectAnnualLeaveEmpKeysFromAttendanceDay } from "./attendanceLeaveAgg";
import { loadAttendanceDaySnapshot } from "./attendanceLeaveScope";
import {
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import {
  claimAnnualLeaveDailySync,
  completeAnnualLeaveDailySync,
  releaseAnnualLeaveDailySyncClaim,
} from "./annualLeaveDailySyncLock";

export {
  ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS,
  annualLeaveDailySyncLockPath,
  isAnnualLeaveDailySyncLockActive,
  resolveAnnualLeaveDailySyncClaim,
} from "./annualLeaveDailySyncLock";

export function annualLeaveYearMetaPath(year) {
  return `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${ANNUAL_LEAVE_META_KEY}`;
}

/**
 * Fallback sau 00h: đúng 1 client trong N tab persist.
 * Khóa `annualLeaveDailySync/{year}` — các tab khác bỏ qua và tạm ngắt
 * listener cây năm cho đến khi khóa xong (tránh N máy cùng parse snapshot).
 */
export async function syncAnnualLeaveForLocalDayRollover(
  db,
  { todayKey, updatedBy = "", onHeavyWorkStart } = {},
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
    await completeAnnualLeaveDailySync(db, year, todayKey, updatedBy);
    return { skipped: true, reason: "already_synced", year };
  }

  const claim = await claimAnnualLeaveDailySync(db, year, todayKey, updatedBy);
  if (!claim.claimed) {
    return { skipped: true, reason: claim.reason, year };
  }

  try {
    const yesterdayDay = await loadAttendanceDaySnapshot(
      db,
      "attendance",
      yesterdayKey,
    );
    const scopeEmpKeySet =
      collectAnnualLeaveEmpKeysFromAttendanceDay(yesterdayDay);

    if (scopeEmpKeySet.size === 0) {
      await completeAnnualLeaveDailySync(db, year, todayKey, updatedBy);
      return { skipped: true, reason: "no_yesterday_employees", year };
    }

    onHeavyWorkStart?.();

    const result = await persistAnnualLeaveMonthFromAttendance(db, {
      year,
      dateKey: yesterdayKey,
      attendanceRootPath: "attendance",
      updatedBy,
      scopeEmpKeySet,
      resyncAggFromMonth: false,
      touchYearMeta: false,
    });

    await completeAnnualLeaveDailySync(db, year, todayKey, updatedBy);

    return {
      skipped: false,
      year,
      yesterdayKey,
      appliedCount: result?.appliedCount ?? 0,
    };
  } catch (error) {
    await releaseAnnualLeaveDailySyncClaim(db, year).catch(() => {});
    throw error;
  }
}
