import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  foldGioVaoCompare,
  getAttendanceLeaveTypeRaw,
  rawMatchesAttendanceTypeOption,
} from "./attendanceGioVaoTypeOptions";

/** Giá trị đặc biệt trong `loaiPhepFilter`: không có loại phép (chỉ giờ HH:MM hoặc trống). */
export const ATTENDANCE_LEAVE_FILTER_NONE = "__none__";

/**
 * Lọc nhanh «chưa điểm danh»: chỉ khi cả ba trường đều trống — giờ vào, loại phép, ca làm việc.
 * Có bất kỳ giá trị nào trong ba trường → không tính là chưa điểm danh.
 */
export function isEmployeeQuickUnattended(emp) {
  if (emp == null || typeof emp !== "object") return false;
  const hasGioVao = String(emp.gioVao ?? "").trim() !== "";
  const hasLoaiPhep = String(emp.loaiPhep ?? "").trim() !== "";
  const hasCaLamViec = String(emp.caLamViec ?? "").trim() !== "";
  return !hasGioVao && !hasLoaiPhep && !hasCaLamViec;
}

function findAttendanceLeaveOptionByFilterValue(sel) {
  const s = String(sel ?? "").trim();
  if (!s) return undefined;
  return ATTENDANCE_LOAI_PHEP_OPTIONS.find(
    (o) =>
      o.value === s ||
      o.shortLabel === s ||
      foldGioVaoCompare(o.value) === foldGioVaoCompare(s) ||
      foldGioVaoCompare(o.shortLabel) === foldGioVaoCompare(s),
  );
}

export function employeeMatchesLoaiPhepFilter(emp, selectedValues) {
  if (!selectedValues || selectedValues.length === 0) return true;
  const raw = getAttendanceLeaveTypeRaw(emp);
  const trimmed = String(raw || "").trim();
  const isNone = !trimmed;

  for (const sel of selectedValues) {
    if (sel === ATTENDANCE_LEAVE_FILTER_NONE) {
      if (isNone) return true;
      continue;
    }
    const opt = findAttendanceLeaveOptionByFilterValue(sel);
    if (opt && rawMatchesAttendanceTypeOption(raw, opt)) return true;
  }
  return false;
}

/** Ngày chọn trên ô date / URL `?date=` — đồng bộ với Firebase path `attendance/YYYY-MM-DD`. */
export const ISO_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Chiều cao cố định panel menu «Bộ lọc» (dropdown); chỉ thu nhỏ khi không đủ chỗ trong viewport. */
export const ATTENDANCE_FILTER_DROPDOWN_HEIGHT_PX = 270;

export function attendanceTableWrapperMinWidthClass(columnPlan) {
  switch (columnPlan) {
    case "full":
      return "min-w-[1128px]";
    case "compact":
      return "min-w-[1040px]";
    case "narrow":
      return "min-w-[872px]";
    case "minimal":
      return "min-w-0";
    default:
      return "min-w-[968px]";
  }
}
