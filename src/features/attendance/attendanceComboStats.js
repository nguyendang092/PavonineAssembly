/**
 * Cờ KPI thống kê combo (`getAttendanceComboFlags`) — modal Thống kê điểm danh, drill-down KPI,
 * (KPI / drill-down — không dùng cho bảng lương tháng).
 *
 * **Không dùng cho tính giờ công (GC/TC):** số giờ trên bảng điểm danh / lương tháng lấy từ
 * `attendanceWorkingHours.js` (`getAttendanceWorkingHoursHours`, `formatPayrollTableWorkingHoursCell`, …)
 * và `payrollMonthlyCoefficientBuckets.js` (`getPayrollMonthlyMainRowCell`, `getPayrollMonthlyCoeffHoursMap`),
 * dựa trên `timeIn` / `timeOut` / `leaveType` (RTDB: gioVao/gioRa/loaiPhep) + `isAttendanceActualLeaveType` — **không** import cờ ở đây.
 *
 * Chỉnh logic KPI (vd. tránh đếm trùng PN + «Chấm công») **không** đổi công thức giờ công trừ khi
 * đồng thời sửa các module trên.
 */

import {
  foldGioVaoCompare,
  getAttendanceLeaveTypeRaw,
  matchAttendanceLoaiPhepOptionIncludingAliases,
  textMatchesAttendanceBuGioCongAlias,
  textMatchesFuneralLeave,
} from "./attendanceGioVaoTypeOptions";
import { isBoPhanChuaDung } from "./attendanceDayMeta";
import { isNightShiftCaLamViec } from "./attendanceWorkingHours";
import {
  ATTENDANCE_EMP,
  pickAttendanceEmployeeDayFields,
} from "./attendanceEmployeeFields";

export const normalizeTextValue = (value) => String(value ?? "").trim();

const CO_DI_LAM_FOLD_SHORT = foldGioVaoCompare("Có");

/** Khớp alias BGC trên giờ vào / ghi chú — rộng hơn `loaiPhep` (thêm ghi tắt «Có»). */
export function textMatchesBuGioCong(raw) {
  const t = normalizeTextValue(raw).replace(/\u00a0/g, " ");
  if (!t) return false;
  if (textMatchesAttendanceBuGioCongAlias(t)) return true;
  return foldGioVaoCompare(t) === CO_DI_LAM_FOLD_SHORT;
}

/** Giờ chuẩn HH:MM (hoặc HH:MM:SS), không nhận text loại phép / ngoài 24h */
export const GIO_VAO_HHMM_STRICT = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Giờ vào (chuỗi tự do): Thai sản / TS / maternity — bỏ dấu, so khớp chặt hơn token PN. */
export function gioVaoTextLooksLikeMaternity(raw) {
  const s = normalizeTextValue(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!s) return false;
  if (s.includes("THAI SAN") || s.includes("THAISAN")) return true;
  if (s.includes("MATERNITY")) return true;
  const compact = s.replace(/\s+/g, "");
  if (compact.includes("THAISAN")) return true;
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.includes("TS")) return true;
  return false;
}

/** Cùng logic với thống kê combo chart — dùng cho bảng chi tiết khi bấm KPI */
export function getAttendanceComboFlags(emp) {
  const day = pickAttendanceEmployeeDayFields(emp);
  const timeInRaw = normalizeTextValue(day.timeIn);
  const leaveTypeRaw = normalizeTextValue(getAttendanceLeaveTypeRaw(emp));
  const isTimeFormat = /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeInRaw);
  const textSignalRaw = leaveTypeRaw || (isTimeFormat ? "" : timeInRaw);
  const nonStandardTimeIn =
    timeInRaw !== "" && !GIO_VAO_HHMM_STRICT.test(timeInRaw);
  // Trường hợp cần theo dõi riêng: không có giờ vào HH:MM nhưng có loại phép.
  const timeInHashHHMM = timeInRaw === "" && leaveTypeRaw !== "";
  const gioVaoNormalized = normalizeTextValue(textSignalRaw)
    .replace(/\u00a0/g, " ")
    .toUpperCase();
  const gioVaoLatin = gioVaoNormalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const gioVaoTokens = gioVaoLatin
    .split(/[^A-Z0-9/]+/)
    .flatMap((t) => t.split("/"))
    .filter(Boolean);
  const hasLeaveCode = (...codes) =>
    codes.some((code) => gioVaoTokens.includes(code));
  const hasText = (...texts) => texts.some((txt) => gioVaoLatin.includes(txt));
  /** Ca đêm chỉ theo cột «Ca làm việc» — đồng bộ `isNightShiftCaLamViec` (lương / giờ công). */
  const isNightShiftRow = isNightShiftCaLamViec(day.shiftCode);
  const isLate = hasLeaveCode("VT") || hasText("VAO TRE");
  /** Tách khỏi PN cả ngày — thống kê Dashboard có ô riêng 1/2PN */
  const halfAnnualHeuristic =
    hasLeaveCode("1/2PN") ||
    hasText("1/2 PHEP NAM", "1/2PHEPNAM", "1/2 PN");
  const hasCheckIn =
    isTimeFormat || hasText("CO DI LAM", "DI LAM") || isLate;
  /**
   * NV quên chấm giờ nhưng có mặt — ghi «Bù giờ công» / BGC / «Có đi làm» ở Giờ vào / ghi chú.
   * Tách biệt checkedIn (giờ HH:MM, BGC trong luồng chấm công…).
   */
  const buGioCongMatch =
    textMatchesBuGioCong(textSignalRaw) ||
    textMatchesBuGioCong(emp[ATTENDANCE_EMP.CHAM_CONG]) ||
    textMatchesBuGioCong(emp[ATTENDANCE_EMP.PHEP_NAM]);
  const isAnnualLeave =
    !halfAnnualHeuristic &&
    (hasLeaveCode("PN") || hasText("PHEP NAM"));
  const isLaborAccident = hasLeaveCode("TN") || hasText("TNLD", "TAI NAN");
  const isMaternity =
    hasLeaveCode("TS") ||
    hasText("THAI SAN", "THAISAN") ||
    gioVaoTextLooksLikeMaternity(textSignalRaw);
  const isNoPermit = hasLeaveCode("KP") || hasText("KHONG PHEP");
  const isUnpaidLeave = hasLeaveCode("KL") || hasText("KHONG LUONG");
  const isSickLeave = hasLeaveCode("PO") || hasText("PHEP OM", "NGHI OM");
  /** Phép tang: giờ vào + chấm công / PN (ghi chú) — đồng bộ với dropdown & Excel */
  const isFuneralLeave =
    textMatchesFuneralLeave(textSignalRaw) ||
    textMatchesFuneralLeave(emp[ATTENDANCE_EMP.CHAM_CONG]) ||
    textMatchesFuneralLeave(emp[ATTENDANCE_EMP.PHEP_NAM]);
  const isResignedLeave = hasLeaveCode("NV") || hasText("NGHI VIEC");

  /** Khớp từng loại trong ATTENDANCE_LOAI_PHEP_OPTIONS (cột loại phép / trạng thái) + ghi chú liên quan */
  const scanRaws = [
    textSignalRaw,
    timeInRaw,
    normalizeTextValue(emp[ATTENDANCE_EMP.CHAM_CONG]),
    normalizeTextValue(emp[ATTENDANCE_EMP.PHEP_NAM]),
  ].filter(Boolean);
  const typeHitKeys = new Set();
  for (const raw of scanRaws) {
    const matched = matchAttendanceLoaiPhepOptionIncludingAliases(raw);
    if (matched?.comboStatKey) typeHitKeys.add(matched.comboStatKey);
  }

  const weddingLeave =
    typeHitKeys.has("weddingLeave") ||
    hasLeaveCode("PC") ||
    hasText("PHEP CUOI", "PHEPCUOI");
  const recuperationLeave =
    typeHitKeys.has("recuperationLeave") ||
    hasLeaveCode("DS") ||
    hasText("DUONG SUC", "DUONGSUC");

  const halfAnnualLeave =
    halfAnnualHeuristic || typeHitKeys.has("halfAnnualLeave");
  const annualLeave =
    !halfAnnualLeave &&
    (isAnnualLeave || typeHitKeys.has("annualLeave"));

  /** Trễ được tách ô riêng — không đếm vào checkedIn để cộng các KPI không bị trùng một người hai lần. */
  const lateFinal = isLate || typeHitKeys.has("late");

  /**
   * Đã xếp loại phép / trạng thái nghỉ (PN, PO, …): không đếm trùng ô «Chấm công» /
   * giờ vào lệch chuẩn / «#» — ví dụ còn HH:MM hoặc ghi «đột xuất» ở Giờ vào nhưng
   * cột Loại phép đã chuyển PN.
   * (VT/BGC không nằm đây — vẫn xử lý qua lateFinal / buGioCong.)
   */
  const leaveStatSuppressesAttendanceSurface =
    annualLeave ||
    halfAnnualLeave ||
    (isSickLeave || typeHitKeys.has("sickLeave")) ||
    (isUnpaidLeave || typeHitKeys.has("unpaidLeave")) ||
    (isNoPermit || typeHitKeys.has("noPermit")) ||
    (isMaternity || typeHitKeys.has("maternity")) ||
    (isLaborAccident || typeHitKeys.has("laborAccident")) ||
    weddingLeave ||
    (isFuneralLeave || typeHitKeys.has("funeralLeave")) ||
    recuperationLeave ||
    (isResignedLeave || typeHitKeys.has("resignedLeave"));

  /**
   * Ca đêm (cột ca) độc lập với chấm công / giờ vào: không đếm trùng các ô
   * checkedIn, buGioCong, nonStandardTimeIn, timeInHashHHMM khi là ca đêm.
   */
  const gioVaoComboMetricsActive = !isNightShiftRow;

  return {
    nonStandardTimeIn:
      nonStandardTimeIn &&
      gioVaoComboMetricsActive &&
      !leaveStatSuppressesAttendanceSurface,
    timeInHashHHMM:
      timeInHashHHMM &&
      gioVaoComboMetricsActive &&
      !leaveStatSuppressesAttendanceSurface,
    checkedIn:
      hasCheckIn &&
      !lateFinal &&
      gioVaoComboMetricsActive &&
      !leaveStatSuppressesAttendanceSurface,
    buGioCong:
      gioVaoComboMetricsActive &&
      (buGioCongMatch || typeHitKeys.has("buGioCong")),
    late: lateFinal,
    annualLeave,
    halfAnnualLeave,
    nightShift: isNightShiftRow,
    laborAccident:
      isLaborAccident || typeHitKeys.has("laborAccident"),
    maternity: isMaternity || typeHitKeys.has("maternity"),
    weddingLeave,
    noPermit: isNoPermit || typeHitKeys.has("noPermit"),
    unpaidLeave: isUnpaidLeave || typeHitKeys.has("unpaidLeave"),
    sickLeave: isSickLeave || typeHitKeys.has("sickLeave"),
    funeralLeave:
      isFuneralLeave || typeHitKeys.has("funeralLeave"),
    recuperationLeave,
    resignedLeave:
      isResignedLeave || typeHitKeys.has("resignedLeave"),
    /** Kiểm tra bộ phận — `boPhanChuaDung` = YES trên Firebase */
    wrongDepartment: isBoPhanChuaDung(emp.boPhanChuaDung),
  };
}
