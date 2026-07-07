import { normalizeAttendanceGioiTinhValue } from "./attendanceGender";

/**
 * STT riêng điểm danh thời vụ — Firebase `seasonalAttendance/{ngày}/{key}/sttThoiVu`.
 * Không dùng `stt` (chính thức) để tránh lệch khi dữ liệu bị trộn.
 */
const SEASONAL_ATTENDANCE_ROOT = "seasonalAttendance";
const KOREAN_ATTENDANCE_ROOT = "koreanAttendance";

export { KOREAN_ATTENDANCE_ROOT };

export function isSeasonalAttendanceRoot(attendanceRootPath) {
  return attendanceRootPath === SEASONAL_ATTENDANCE_ROOT;
}

export function isKoreanAttendanceRoot(attendanceRootPath) {
  return attendanceRootPath === KOREAN_ATTENDANCE_ROOT;
}

/** Điểm danh tách khỏi phép năm / attendance chính (thời vụ, nhân viên Hàn). */
export function shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath) {
  return (
    isSeasonalAttendanceRoot(attendanceRootPath) ||
    isKoreanAttendanceRoot(attendanceRootPath)
  );
}

function hasSeasonalSttFieldValue(raw) {
  if (raw === "" || raw == null || raw === undefined) return false;
  const s = String(raw).trim();
  return s !== "";
}

/**
 * Chuẩn hóa dòng thời vụ khi đọc UI / so sánh:
 * - Chỉ dùng `sttThoiVu` (copy từ `stt` legacy nếu còn sót sau upload cũ).
 * - Xóa `stt` chính thức khỏi object hiển thị.
 */
export function normalizeSeasonalAttendanceRowForUi(emp) {
  if (!emp || typeof emp !== "object") return emp;
  const out = { ...emp };
  if (
    !hasSeasonalSttFieldValue(out.sttThoiVu) &&
    hasSeasonalSttFieldValue(out.stt)
  ) {
    out.sttThoiVu = out.stt;
  }
  delete out.stt;
  const gioiTinhNorm = normalizeAttendanceGioiTinhValue(out.gioiTinh);
  if (gioiTinhNorm) {
    out.gioiTinh = gioiTinhNorm;
  }
  return out;
}

function getAttendanceSttRawForContext(emp, seasonal) {
  if (!emp || typeof emp !== "object") return undefined;
  return seasonal ? emp.sttThoiVu : emp.stt;
}

export function getAttendanceSortSttValue(emp, seasonal) {
  const raw = getAttendanceSttRawForContext(emp, seasonal);
  if (raw === "" || raw == null || raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** STT hiển thị — khớp bảng: `sttThoiVu` (thời vụ) hoặc `stt` (chính thức), không thì thứ tự sau sort. */
export function resolveAttendanceDisplayStt(emp, sortedIndexOneBased, seasonal) {
  const raw = getAttendanceSttRawForContext(emp, seasonal);
  if (raw !== "" && raw != null && raw !== undefined) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
    const s = String(raw).trim();
    if (s) {
      const n2 = Number(s);
      if (Number.isFinite(n2) && n2 > 0) return n2;
      return s;
    }
  }
  return sortedIndexOneBased ?? null;
}
