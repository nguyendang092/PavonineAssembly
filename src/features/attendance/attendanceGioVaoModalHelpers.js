import {
  canonicalAttendanceLoaiPhepValue,
  matchAttendanceLoaiPhepOptionIncludingAliases,
} from "./attendanceGioVaoTypeOptions";

/** Chuẩn hóa cho input type="time" (HH:MM) */
export function normalizeTimeForHtmlInput(s) {
  const t = String(s ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return "";
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0");
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Khớp chuỗi loại phép (mã PN, PO, …) với option chuẩn.
 * Dùng `ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH` để «1/2 Phép năm» khớp trước «Phép năm».
 */
export function findGioVaoTypeOptionMatch(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return matchAttendanceLoaiPhepOptionIncludingAliases(t);
}

/** Chuẩn hóa giá trị lưu + hiển thị `<select>` Loại phép (alias → `value` đầy đủ). */
export function canonicalAttendanceLoaiPhep(raw) {
  return canonicalAttendanceLoaiPhepValue(raw);
}
