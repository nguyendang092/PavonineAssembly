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

export function isSaturdayDateKey(dateKey) {
  const pd = parseLocalDateKey(String(dateKey ?? ""));
  return Boolean(pd && pd.getDay() === 6);
}

/** Thứ 7 / Chủ nhật — Tài xế tổng luôn tính như ngày thường (bỏ cờ off lịch). */
export function isTaiXeTongWeekendNormalWeekday(dateKey) {
  return isSundayDateKey(dateKey) || isSaturdayDateKey(dateKey);
}

/**
 * Tài xế tổng — **Thứ 2** luôn là ngày off (TC off ×2.0); **Thứ 7 & Chủ nhật** luôn ngày thường
 * (bỏ cờ off lịch công ty nếu có).
 */
export function resolveTaiXeTongEffectiveIsOffDay({
  includeTaiXeTongInWorkingHours = false,
  dateKey = null,
  isOffDay = false,
} = {}) {
  if (!isTaiXeTongRegime(includeTaiXeTongInWorkingHours)) {
    return Boolean(isOffDay);
  }
  if (isTaiXeTongWeekendNormalWeekday(dateKey)) return false;
  if (isMondayDateKey(dateKey)) return true;
  return Boolean(isOffDay);
}

/**
 * Tài xế tổng — **Thứ 7 & Chủ nhật** tính như ngày thường (không gộp hệ số cuối tuần).
 */
export function shouldTaiXeTongTreatSundayAsNormalWeekday({
  includeTaiXeTongInWorkingHours = false,
  dateKey = null,
} = {}) {
  return (
    isTaiXeTongRegime(includeTaiXeTongInWorkingHours) &&
    isTaiXeTongWeekendNormalWeekday(dateKey)
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
