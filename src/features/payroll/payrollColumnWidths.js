/**
 * Độ rộng cột bảng lương (PayrollSalaryCalculator): trọng số tương đối theo từng `columnPlan`.
 * Không cần tổng = 100 — hệ thống chuẩn hóa về % khi render.
 * Chỉ sửa file này để chỉnh cột rộng/hẹp; thứ tự phải khớp số cột trong AttendanceTableRow.
 */

function normalizePercents(widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) return widths;
  return widths.map((w) => (w / sum) * 100);
}

/* full — … | Ngày off | Ngày lễ | Giờ công … GC ngày lễ … | Tổng GC … */
export const PAYROLL_WIDTHS_FULL_NO_ACTIONS = [
  2, 6, 5, 18, 5, 8, 5, 5, 9, 5, 5, 5, 6, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
];

/** Trọng số cột hành động (Sửa) — nối sau PAYROLL_*_NO_ACTIONS khi `showRowModalActions`. */
export const PAYROLL_WIDTH_ACTIONS = 2;

/* compact */
export const PAYROLL_WIDTHS_COMPACT_NO_ACTIONS = [
  7, 10, 8, 18, 6, 18, 5, 11, 5, 8, 5, 5, 5, 4, 4, 4, 4, 4, 5, 5, 5, 5, 8,
];

/* narrow (+ cột lễ) */
export const PAYROLL_WIDTHS_NARROW_NO_ACTIONS = [
  8, 11, 9, 22, 7, 5, 13, 9, 5, 6, 5, 5, 5, 4, 4, 4, 4, 5, 5, 4, 11, 4,
];

/* minimal */
export const PAYROLL_WIDTHS_MINIMAL_NO_ACTIONS = [
  17, 19, 12, 11, 10, 8, 6, 5, 5, 5, 6, 5, 6, 5, 6, 12, 5,
];

/**
 * @param {"full"|"compact"|"narrow"|"minimal"} columnPlan
 * @returns {number[]} Tỉ lệ % đã chuẩn hóa (tổng 100).
 */
export function getPayrollColWidthPercents(
  showRowModalActions,
  columnPlan = "full",
) {
  let base;
  if (columnPlan === "minimal") {
    base = PAYROLL_WIDTHS_MINIMAL_NO_ACTIONS;
  } else if (columnPlan === "narrow") {
    base = PAYROLL_WIDTHS_NARROW_NO_ACTIONS;
  } else if (columnPlan === "compact") {
    base = PAYROLL_WIDTHS_COMPACT_NO_ACTIONS;
  } else {
    base = PAYROLL_WIDTHS_FULL_NO_ACTIONS;
  }
  if (showRowModalActions) {
    base = [...base, PAYROLL_WIDTH_ACTIONS];
  }
  return normalizePercents(base);
}
