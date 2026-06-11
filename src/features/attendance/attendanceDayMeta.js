/**
 * Metadata theo ngày tại `attendance/{YYYY-MM-DD}/_meta` (không phải bản ghi nhân viên).
 */

export const ATTENDANCE_DAY_META_KEY = "_meta";

/**
 * Bảng lương: map `employeeId` (key Firebase của dòng `attendance/{ngày}/{id}`) → có giấy TC sớm 06:00–07:40 (vào ≤ 06:40).
 * Lưu tại `attendance/{ngày}/_meta.earlyOtPaperwork`.
 */
export const ATTENDANCE_DAY_META_EARLY_OT_KEY = "earlyOtPaperwork";
/** Bảng lương: map employeeId -> có giấy đăng ký tăng ca sau 17:30. */
export const ATTENDANCE_DAY_META_LATE_OT_KEY = "lateOtPaperwork";

/** @param {unknown} raw */
export function normalizeEarlyOtPaperworkMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "boolean") out[k] = v;
    else if (v === 1 || v === "1" || v === "true") out[k] = true;
    else if (v === 0 || v === "0" || v === "false") out[k] = false;
  }
  return out;
}

/** @param {unknown} raw */
export function normalizeLateOtPaperworkMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "boolean") out[k] = v;
    else if (v === 1 || v === "1" || v === "true") out[k] = true;
    else if (v === 0 || v === "0" || v === "false") out[k] = false;
  }
  return out;
}

/**
 * @param {Record<string, unknown> | null | undefined} rawData — snapshot `attendance/{ngày}`.
 * @returns {Record<string, boolean>}
 */
export function getEarlyOtPaperworkFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return {};
  const m = rawData[ATTENDANCE_DAY_META_KEY];
  if (!m || typeof m !== "object") return {};
  return normalizeEarlyOtPaperworkMap(m[ATTENDANCE_DAY_META_EARLY_OT_KEY]);
}

/**
 * @param {Record<string, unknown> | null | undefined} rawData — snapshot `attendance/{ngày}`.
 * @returns {Record<string, boolean>}
 */
export function getLateOtPaperworkFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return {};
  const m = rawData[ATTENDANCE_DAY_META_KEY];
  if (!m || typeof m !== "object") return {};
  return normalizeLateOtPaperworkMap(m[ATTENDANCE_DAY_META_LATE_OT_KEY]);
}

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

/**
 * Ngày lễ (`_meta.isHolidayDay`) — hiển thị HOLIDAY; công/lương giống ngày off.
 * @param {Record<string, unknown> | null | undefined} rawData
 * @returns {boolean}
 */
export function getIsHolidayDayFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return false;
  const m = rawData[ATTENDANCE_DAY_META_KEY];
  return Boolean(m && typeof m === "object" && m.isHolidayDay);
}

/**
 * Nghỉ bù (`_meta.isCompensatoryDay`) — công/lương như ngày off (TC off, không phải cột lễ).
 * Cấu hình trong menu OFF/Lễ/Nghỉ bù + bảng Lương; không có cột riêng trên bảng điểm danh.
 * @param {Record<string, unknown> | null | undefined} rawData
 * @returns {boolean}
 */
export function getIsCompensatoryDayFromRaw(rawData) {
  if (!rawData || typeof rawData !== "object") return false;
  const m = rawData[ATTENDANCE_DAY_META_KEY];
  return Boolean(m && typeof m === "object" && m.isCompensatoryDay);
}

/**
 * Giá trị lưu «Không» (`NO` / tương đương) — không hiện NB trên lưới tháng.
 * @param {unknown} storedValue — trường `duocNghiBu` (không truyền cả object `emp`).
 */
export function isDuocNghiBuExplicitlyNo(storedValue) {
  const v = String(storedValue ?? "").trim().toUpperCase();
  return v === "NO" || v === "FALSE" || v === "0";
}

/**
 * Kiểm tra bộ phận — lưu trên Firebase RTDB:
 * `attendance/{YYYY-MM-DD}/{firebaseKey}/boPhanChuaDung` (hoặc `seasonalAttendance/...`).
 * `"YES"` = sai bộ phận; không có key / rỗng = đúng.
 */
export function isBoPhanChuaDung(storedValue) {
  const v = String(storedValue ?? "").trim().toUpperCase();
  return v === "YES" || v === "TRUE" || v === "1";
}

/** Form điểm danh: chuẩn `boPhanChuaDung` đọc từ Firebase → `""` | `"YES"`. */
export function normalizeBoPhanChuaDungForForm(storedRaw) {
  return isBoPhanChuaDung(storedRaw) ? "YES" : "";
}

/**
 * Form điểm danh: đồng bộ `duocNghiBu` với cờ ngày nghỉ bù lịch.
 * @returns {"" | "NO" | "YES"}
 */
export function normalizeDuocNghiBuForForm(dayIsCompensatory, storedRaw) {
  if (!dayIsCompensatory) return "";
  return isDuocNghiBuExplicitlyNo(storedRaw) ? "NO" : "YES";
}

/**
 * Lưới tháng / Excel: ký hiệu ô dòng chính khi `getPayrollMonthlyMainRowCell` trả `dash`.
 * `emp == null` = chưa có dòng điểm danh → NB theo lịch (nếu ngày nghỉ bù).
 * @param {{ isHolidayDay?: boolean, isCompensatoryDay?: boolean } | null | undefined} ch
 * @param {unknown} emp
 */
export function payrollMonthMainRowDashMark(ch, emp) {
  if (!ch) return " ";
  if (ch.isHolidayDay) return "NL";
  if (ch.isCompensatoryDay) {
    if (emp == null) return "NB";
    return isDuocNghiBuExplicitlyNo(emp?.duocNghiBu) ? " " : "NB";
  }
  return " ";
}

/**
 * Gộp patch vào `_meta` mà không xóa `earlyOtPaperwork` / trường khác.
 * @param {unknown} existing
 * @param {Record<string, unknown>} patch
 */
export function mergeAttendanceDayMeta(existing, patch) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  return { ...base, ...patch };
}
