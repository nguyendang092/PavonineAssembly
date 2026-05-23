import { PAYROLL_EMPTY_CELL } from "./constants";

/** Bảng lương: null / chỉ khoảng trắng / chuỗi rỗng → `-`. Điểm danh: giữ nguyên. */
export function payrollDash(value, isPayroll) {
  if (!isPayroll) return value;
  if (value === null || value === undefined) return PAYROLL_EMPTY_CELL;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : PAYROLL_EMPTY_CELL;
  }
  const s = String(value).trim();
  if (s === "") return PAYROLL_EMPTY_CELL;
  return s;
}
