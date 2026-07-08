import {
  formatAttendanceLeaveTypeColumnDisplay,
  getAttendanceLeaveTypeRaw,
} from "@/features/attendance/attendanceGioVaoTypeOptions";

/**
 * Metadata theo ngày tại `attendance/{YYYY-MM-DD}/_meta` (không phải bản ghi nhân viên).
 */

export const ATTENDANCE_DAY_META_KEY = "_meta";

/**
 * Bảng lương: map `employeeId` → có giấy TC sớm.
 * Ca ngày: vào ≤ 06:40. Ca đêm S2: vào 15:00–18:40.
 * Lưu tại `attendance/{ngày}/_meta.earlyOtPaperwork`.
 */
export const ATTENDANCE_DAY_META_EARLY_OT_KEY = "earlyOtPaperwork";
/** Bảng lương: map employeeId -> có giấy đăng ký tăng ca sau 17:30. */
export const ATTENDANCE_DAY_META_LATE_OT_KEY = "lateOtPaperwork";

/** @param {unknown} raw */
function normalizeBooleanRecordMap(raw) {
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
export function normalizeEarlyOtPaperworkMap(raw) {
  return normalizeBooleanRecordMap(raw);
}

/** @param {unknown} raw */
export function normalizeLateOtPaperworkMap(raw) {
  return normalizeBooleanRecordMap(raw);
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
 * Nền vàng nhạt cột họ tên — `attendance/{ngày}/{key}/hoVaTenNenVang`.
 * `"YES"` = bật; không có key / rỗng = tắt.
 */
export function isHoVaTenYellowHighlight(storedValue) {
  const v = String(storedValue ?? "").trim().toUpperCase();
  return v === "YES" || v === "TRUE" || v === "1";
}

export function normalizeHoVaTenYellowHighlightForForm(storedRaw) {
  return isHoVaTenYellowHighlight(storedRaw) ? "YES" : "";
}

/** Class Tailwind cho ô họ tên trên bảng điểm danh / giờ công (không dùng trong form). */
export function attendanceHoVaTenYellowCellClassName(enabled) {
  return enabled
    ? " !bg-yellow-100 hover:!bg-yellow-200 dark:!bg-yellow-900/40 dark:hover:!bg-yellow-900/55 self-stretch flex items-center"
    : "";
}

/**
 * Form điểm danh: đồng bộ `duocNghiBu` với cờ ngày nghỉ bù lịch.
 * @returns {"" | "NO" | "YES"}
 */
export function normalizeDuocNghiBuForForm(dayIsCompensatory, storedRaw) {
  if (!dayIsCompensatory) return "";
  return isDuocNghiBuExplicitlyNo(storedRaw) ? "NO" : "YES";
}

const COMPENSATORY_NB_BLOCKED_LEAVE_CODES = new Set(["NV", "TS"]);

function attendanceLeaveShortBlocksCompensatoryNb(emp) {
  if (!emp || typeof emp !== "object") return false;
  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  if (!leaveRaw) return false;
  const leaveShort = formatAttendanceLeaveTypeColumnDisplay(leaveRaw);
  return COMPENSATORY_NB_BLOCKED_LEAVE_CODES.has(leaveShort);
}

/** Loại phép NV — không hiển thị / không đếm NB nghỉ bù lịch. */
export function isAttendanceLeaveTypeNv(emp) {
  if (!emp || typeof emp !== "object") return false;
  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  if (!leaveRaw) return false;
  return formatAttendanceLeaveTypeColumnDisplay(leaveRaw) === "NV";
}

/**
 * Ngày nghỉ bù lịch có được tính/hiển thị NB cho nhân viên.
 * @param {{ isCompensatoryDay?: boolean } | Record<string, unknown> | null | undefined} dayCtx — chunk ngày hoặc snapshot `attendance/{ngày}`
 * @param {unknown} [emp]
 */
export function isCompensatoryNbVisibleForDayContext(dayCtx, emp) {
  const isCompDay =
    Boolean(dayCtx?.isCompensatoryDay) || getIsCompensatoryDayFromRaw(dayCtx);
  if (!isCompDay) return false;
  if (emp != null) {
    if (attendanceLeaveShortBlocksCompensatoryNb(emp)) return false;
    if (isDuocNghiBuExplicitlyNo(emp?.duocNghiBu)) return false;
  }
  return true;
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
  if (isCompensatoryNbVisibleForDayContext(ch, emp)) return "NB";
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
