/**
 * Metadata theo ngày tại `attendance/{YYYY-MM-DD}/_meta` (không phải bản ghi nhân viên).
 */

export const ATTENDANCE_DAY_META_KEY = "_meta";

/** Bỏ qua khi gộp danh sách nhân viên từ snapshot ngày. */
export function isAttendanceDayMetaKey(id) {
  return id === ATTENDANCE_DAY_META_KEY || String(id).startsWith("__");
}

/**
 * @param {Record<string, unknown> | null | undefined} rawData
 * @returns {boolean}
 */
export function getIsOffDayFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return false;
  const m = rawData[ATTENDANCE_DAY_META_KEY];
  return Boolean(m && typeof m === "object" && m.isOffDay);
}
