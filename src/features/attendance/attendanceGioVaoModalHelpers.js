import {
  ATTENDANCE_GIO_VAO_TYPE_OPTIONS,
  rawMatchesAttendanceTypeOption,
} from "./attendanceGioVaoTypeOptions";

/** Giá trị đặc biệt cho select modal: nhập giờ HH:MM */
export const GIO_VAO_MODAL_TIME_SENTINEL = "__modal_time__";
/** Giá trị đặc biệt: dữ liệu cũ / tự do không khớp danh sách */
export const GIO_VAO_MODAL_OTHER_SENTINEL = "__modal_other__";

export function looksLikeGioVaoTime(s) {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(s ?? "").trim());
}

/** Chuẩn hóa cho input type="time" (HH:MM) */
export function normalizeTimeForHtmlInput(s) {
  const t = String(s ?? "").trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return "";
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0");
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function findGioVaoTypeOptionMatch(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return (
    ATTENDANCE_GIO_VAO_TYPE_OPTIONS.find(
      (o) => o.value === t || rawMatchesAttendanceTypeOption(t, o),
    ) ?? null
  );
}

export function getGioVaoModalSelectValue(formGioVao) {
  const raw = String(formGioVao ?? "").trim();
  if (!raw) return "";
  if (looksLikeGioVaoTime(raw)) return GIO_VAO_MODAL_TIME_SENTINEL;
  const opt = findGioVaoTypeOptionMatch(raw);
  if (opt) return opt.value;
  return GIO_VAO_MODAL_OTHER_SENTINEL;
}
