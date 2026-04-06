/**
 * Phân trang danh sách employeeProfiles (RTDB + lọc client).
 * Mặc định 50; người dùng đổi trên UI và lưu localStorage.
 */

export const EMPLOYEE_ROSTER_PAGE_SIZE_STORAGE_KEY =
  "pavonine.employeeRoster.pageSize";

/** Các mức hợp lệ (chỉnh danh sách này nếu cần thêm 75, 200…). */
export const EMPLOYEE_ROSTER_PAGE_SIZE_OPTIONS = Object.freeze([
  25, 50, 100,
]);

export const EMPLOYEE_ROSTER_DEFAULT_PAGE_SIZE = 50;

export function readStoredEmployeeRosterPageSize() {
  if (typeof window === "undefined") return EMPLOYEE_ROSTER_DEFAULT_PAGE_SIZE;
  try {
    const raw = window.localStorage.getItem(
      EMPLOYEE_ROSTER_PAGE_SIZE_STORAGE_KEY,
    );
    const v = Number(raw);
    if (EMPLOYEE_ROSTER_PAGE_SIZE_OPTIONS.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return EMPLOYEE_ROSTER_DEFAULT_PAGE_SIZE;
}

export function persistEmployeeRosterPageSize(n) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      EMPLOYEE_ROSTER_PAGE_SIZE_STORAGE_KEY,
      String(n),
    );
  } catch {
    /* ignore */
  }
}
