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

/* full — 20 cột: … | Ca | Ngày off | Giờ công | … TC off | Tổng GC | … | Tổng GC ca đêm; +1 Sửa khi có actions */
export const PAYROLL_WIDTHS_FULL_NO_ACTIONS = [
  2, 3, 3, 10, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 3, 3, 3, 4,
];

/** Trọng số cột hành động (Sửa) — nối sau PAYROLL_*_NO_ACTIONS khi `showRowModalActions`. */
export const PAYROLL_WIDTH_ACTIONS = 2;

/* compact — 18 cột */
export const PAYROLL_WIDTHS_COMPACT_NO_ACTIONS = [
  7, 6, 6, 14, 6, 13, 10, 8, 5, 5, 5, 4, 4, 3, 5, 5, 5, 9,
];

/* narrow — 18 cột */
export const PAYROLL_WIDTHS_NARROW_NO_ACTIONS = [
  8, 7, 7, 18, 7, 12, 9, 6, 5, 5, 5, 4, 3, 5, 5, 12, 4,
];

/* minimal — 13 cột */
export const PAYROLL_WIDTHS_MINIMAL_NO_ACTIONS = [
  14, 15, 12, 10, 8, 6, 6, 4, 4, 6, 6, 13, 5,
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
