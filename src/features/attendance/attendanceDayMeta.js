import {
  formatAttendanceLeaveTypeColumnDisplay,
  getAttendanceLeaveTypeRaw,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import {
  effectivePayrollEarlyOtPaperwork,
  getNightShiftPayrollOvertimeHours,
  getPayrollDayOvertimeHoursNumeric,
  isNightShiftCaLamViec,
  parseLunchOtHours,
} from "@/features/attendance/attendanceWorkingHours";

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
 * Nền cả dòng — cờ `"YES"` trên node `attendance/{ngày}/{key}`.
 * `hoVaTenNenVang` = check tăng ca; `loaiPhepCheck` = check loại phép.
 */
function isAttendanceYesFlag(storedValue) {
  const v = String(storedValue ?? "").trim().toUpperCase();
  return v === "YES" || v === "TRUE" || v === "1";
}

export function isHoVaTenYellowHighlight(storedValue) {
  return isAttendanceYesFlag(storedValue);
}

export function isLeaveTypeCheckHighlight(storedValue) {
  return isAttendanceYesFlag(storedValue);
}

export function normalizeHoVaTenYellowHighlightForForm(storedRaw) {
  return isHoVaTenYellowHighlight(storedRaw) ? "YES" : "";
}

export function normalizeLeaveTypeCheckForForm(storedRaw) {
  return isLeaveTypeCheckHighlight(storedRaw) ? "YES" : "";
}

export function isAttendanceHalfPnLeaveType(leaveType) {
  return formatAttendanceLeaveTypeColumnDisplay(leaveType) === "1/2PN";
}

export function hasAttendanceLeaveTypeSelected(leaveType) {
  return Boolean(String(leaveType ?? "").trim());
}

function payrollStrictOffFromDayCtx(dayCtx = {}) {
  const isCompensatoryDay = Boolean(dayCtx.isCompensatoryDay);
  const koreanTimesheetRules = dayCtx.koreanTimesheetRules === true;
  const compensatoryUsesOffSplit =
    isCompensatoryDay && !koreanTimesheetRules;
  return Boolean(dayCtx.isOffDay) || compensatoryUsesOffSplit;
}

function payrollDayOvertimeOptionsFromDayCtx(dayCtx = {}) {
  return {
    koreanTimesheetRules: dayCtx.koreanTimesheetRules === true,
    isCompensatoryDay: Boolean(dayCtx.isCompensatoryDay),
    dateKey: dayCtx.dateKey ?? null,
  };
}

/**
 * Có giờ công tăng ca > 0 — dùng cho màu tím (1/2PN + check loại phép).
 * Không import `payrollOtDayParams` để tránh vòng phụ thuộc với `PAYROLL_EMP`.
 * @param {object} emp
 * @param {{ isOffDay?: boolean, isHolidayDay?: boolean, isCompensatoryDay?: boolean, koreanTimesheetRules?: boolean, dateKey?: string | null }} [dayCtx]
 */
export function employeeHasPayrollOvertimeHours(emp, dayCtx = {}) {
  if (!emp || typeof emp !== "object") return false;

  const flags = employeeRegimeWorkingHoursFlags(emp);
  const timeIn = emp.gioVao;
  const timeOut = emp.gioRa;
  const shiftCode = emp.caLamViec;
  const lunchOtHours = emp.tangCaTrua;
  const payrollEarlyOtPaperwork = effectivePayrollEarlyOtPaperwork(
    timeIn,
    shiftCode,
    emp.payrollEarlyOtPaperwork,
  );
  const payrollLateOtExcluded = emp.payrollLateOtExcluded;
  const otOptions = payrollDayOvertimeOptionsFromDayCtx(dayCtx);
  const strictOffDay = payrollStrictOffFromDayCtx(dayCtx);
  const isHolidayDay = Boolean(dayCtx.isHolidayDay);

  if (isNightShiftCaLamViec(shiftCode)) {
    const nightOt = getNightShiftPayrollOvertimeHours(
      timeIn,
      timeOut,
      shiftCode,
      payrollEarlyOtPaperwork,
    );
    const lunchOt = parseLunchOtHours(lunchOtHours);
    return (nightOt != null && nightOt > 0) || lunchOt > 0;
  }

  const dayOt = getPayrollDayOvertimeHoursNumeric(
    timeIn,
    timeOut,
    strictOffDay,
    shiftCode,
    payrollEarlyOtPaperwork,
    isHolidayDay,
    payrollLateOtExcluded,
    flags.includeTapVuInWorkingHours,
    flags.includeThaiSanInWorkingHours,
    flags.includeTaiXeInWorkingHours,
    flags.includeTaiXeTongInWorkingHours,
    lunchOtHours,
    otOptions,
  );
  return dayOt != null && dayOt > 0;
}

/** Check loại phép tím: chỉ 1/2PN + có giờ TC, không kèm check tăng ca. */
export function isLeaveTypeCheckPurpleHighlight({
  otCheck = false,
  leaveTypeCheck = false,
  leaveType = "",
  hasOvertimeHours = false,
} = {}) {
  if (otCheck || !leaveTypeCheck) return false;
  return isAttendanceHalfPnLeaveType(leaveType) && hasOvertimeHours;
}

/**
 * Class nền cả dòng:
 * - Check tăng ca (hoặc cả hai check) → vàng
 * - Chỉ check loại phép + 1/2PN + có giờ TC → tím
 * - Chỉ check loại phép (còn lại, hoặc 1/2PN không TC) → vàng
 */
export function attendanceRowCheckHighlightClassName({
  otCheck = false,
  leaveTypeCheck = false,
  leaveType = "",
  hasOvertimeHours = false,
} = {}) {
  if (isLeaveTypeCheckPurpleHighlight({
    otCheck,
    leaveTypeCheck,
    leaveType,
    hasOvertimeHours,
  })) {
    return "att-row-check-leave";
  }
  if (otCheck || leaveTypeCheck) return "att-row-check-ot";
  return "";
}

/** Check tăng ca bật mà chưa chọn loại phép → khóa check loại phép. */
export function isLeaveTypeCheckFieldDisabled({
  otCheck = false,
  leaveType = "",
  isViewOnly = false,
} = {}) {
  if (isViewOnly) return true;
  return otCheck && !hasAttendanceLeaveTypeSelected(leaveType);
}

/** 1/2PN không có giờ TC → khóa check tăng ca. */
export function isOtCheckFieldDisabled({
  leaveType = "",
  hasOvertimeHours = false,
  isViewOnly = false,
} = {}) {
  if (isViewOnly) return true;
  return isAttendanceHalfPnLeaveType(leaveType) && !hasOvertimeHours;
}

/** @deprecated Dùng `attendanceRowCheckHighlightClassName` trên cả dòng. */
export function attendanceHoVaTenYellowCellClassName(enabled) {
  return enabled ? "" : "";
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
