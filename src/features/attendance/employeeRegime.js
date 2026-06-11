/** Giá trị dropdown «Chế độ nhân viên» (một chế độ / ngày). */
export const EMPLOYEE_REGIME = Object.freeze({
  TAPVU: "TAPVU",
  THAISAN: "THAISAN",
  TAIXE: "TAIXE",
  TAIXETONG: "TAIXETONG",
});

function isYesFlag(v) {
  return v === true || String(v ?? "").trim().toUpperCase() === "YES";
}

/**
 * Cờ chế độ từ bản ghi `attendance/{ngày}/{id}` (kèm legacy `includeTsNvInWorkingHours`).
 * @param {Record<string, unknown> | null | undefined} record
 */
export function resolveEmployeeRegimeFlags(record) {
  const legacyIncludeTsNv = isYesFlag(record?.includeTsNvInWorkingHours);
  return {
    includeTapVuInWorkingHours:
      isYesFlag(record?.includeTapVuInWorkingHours) || legacyIncludeTsNv,
    includeThaiSanInWorkingHours:
      isYesFlag(record?.includeThaiSanInWorkingHours) || legacyIncludeTsNv,
    includeTaiXeInWorkingHours: isYesFlag(record?.includeTaiXeInWorkingHours),
    includeTaiXeTongInWorkingHours: isYesFlag(
      record?.includeTaiXeTongInWorkingHours,
    ),
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {"" | typeof EMPLOYEE_REGIME[keyof typeof EMPLOYEE_REGIME]}
 */
export function getEmployeeRegimeSelectValue(record) {
  const f = resolveEmployeeRegimeFlags(record);
  const active = [
    f.includeTapVuInWorkingHours && EMPLOYEE_REGIME.TAPVU,
    f.includeThaiSanInWorkingHours && EMPLOYEE_REGIME.THAISAN,
    f.includeTaiXeInWorkingHours && EMPLOYEE_REGIME.TAIXE,
    f.includeTaiXeTongInWorkingHours && EMPLOYEE_REGIME.TAIXETONG,
  ].filter(Boolean);
  if (active.length !== 1) return "";
  return active[0];
}

/**
 * Map lựa chọn dropdown → cờ lưu Firebase (`"YES"` hoặc `""`).
 * @param {string} value
 */
export function employeeRegimeFlagsFromSelectValue(value) {
  const v = String(value ?? "").trim();
  return {
    includeTapVuInWorkingHours: v === EMPLOYEE_REGIME.TAPVU ? "YES" : "",
    includeThaiSanInWorkingHours: v === EMPLOYEE_REGIME.THAISAN ? "YES" : "",
    includeTaiXeInWorkingHours: v === EMPLOYEE_REGIME.TAIXE ? "YES" : "",
    includeTaiXeTongInWorkingHours:
      v === EMPLOYEE_REGIME.TAIXETONG ? "YES" : "",
  };
}

/** Dữ liệu cũ / lỗi nhập: nhiều hơn một cờ chế độ bật cùng lúc. */
/** Cờ boolean cho `attendanceWorkingHours` (kèm legacy TS/NV). */
export function employeeRegimeWorkingHoursFlags(record) {
  return resolveEmployeeRegimeFlags(record);
}

export function hasConflictingEmployeeRegimeFlags(record) {
  const f = resolveEmployeeRegimeFlags(record);
  const count = [
    f.includeTapVuInWorkingHours,
    f.includeThaiSanInWorkingHours,
    f.includeTaiXeInWorkingHours,
    f.includeTaiXeTongInWorkingHours,
  ].filter(Boolean).length;
  return count > 1;
}
