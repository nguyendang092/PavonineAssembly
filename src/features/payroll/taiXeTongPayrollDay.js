import { parseLocalDateKey } from "@/utils/dateKey";

function isTaiXeTongRegime(includeTaiXeTongInWorkingHours) {
  return (
    includeTaiXeTongInWorkingHours === true ||
    String(includeTaiXeTongInWorkingHours ?? "")
      .trim()
      .toUpperCase() === "YES"
  );
}

export function isMondayDateKey(dateKey) {
  const pd = parseLocalDateKey(String(dateKey ?? ""));
  return Boolean(pd && pd.getDay() === 1);
}

export function isSundayDateKey(dateKey) {
  const pd = parseLocalDateKey(String(dateKey ?? ""));
  return Boolean(pd && pd.getDay() === 0);
}

/**
 * Tài xế tổng — **Thứ 2** luôn là ngày off (TC off ×2.0), kể cả lịch công ty không đánh off.
 */
export function resolveTaiXeTongEffectiveIsOffDay({
  includeTaiXeTongInWorkingHours = false,
  dateKey = null,
  isOffDay = false,
} = {}) {
  if (!isTaiXeTongRegime(includeTaiXeTongInWorkingHours)) {
    return Boolean(isOffDay);
  }
  if (isMondayDateKey(dateKey)) return true;
  return Boolean(isOffDay);
}

/**
 * Tài xế tổng — **Chủ nhật** tính như ngày thường (không gộp hệ số Chủ nhật).
 */
export function shouldTaiXeTongTreatSundayAsNormalWeekday({
  includeTaiXeTongInWorkingHours = false,
  dateKey = null,
} = {}) {
  return (
    isTaiXeTongRegime(includeTaiXeTongInWorkingHours) && isSundayDateKey(dateKey)
  );
}

/** Có áp dụng luật gộp GC+TC Chủ nhật trên lưới tháng hay không. */
export function shouldUsePayrollMonthSundayMergedRules(ctx = {}) {
  if (
    shouldTaiXeTongTreatSundayAsNormalWeekday({
      includeTaiXeTongInWorkingHours: ctx.includeTaiXeTongInWorkingHours,
      dateKey: ctx.dateKey,
    })
  ) {
    return false;
  }
  return isSundayDateKey(ctx.dateKey);
}
