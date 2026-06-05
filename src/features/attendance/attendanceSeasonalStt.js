/**
 * STT riêng điểm danh thời vụ — Firebase `seasonalAttendance/{ngày}/{key}/sttThoiVu`.
 * Không dùng `stt` (chính thức) để tránh lệch khi dữ liệu bị trộn.
 */
export const SEASONAL_ATTENDANCE_ROOT = "seasonalAttendance";

export function isSeasonalAttendanceRoot(attendanceRootPath) {
  return attendanceRootPath === SEASONAL_ATTENDANCE_ROOT;
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
