import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFieldKeys";
import { mnvFromEmpFirebaseKey } from "@/utils/attendanceEmployeeRecord";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

function pickNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

/** Các trường hồ sơ hiển thị trên lưới quản lý phép năm. */
export const ANNUAL_LEAVE_PROFILE_FIELD_KEYS = [
  ANNUAL_LEAVE_EMP.MNV_PREFIX,
  ANNUAL_LEAVE_EMP.MNV_SUFFIX,
  ANNUAL_LEAVE_EMP.FULL_NAME,
  ANNUAL_LEAVE_EMP.DATE_OF_BIRTH,
  ANNUAL_LEAVE_EMP.SUB_DEPARTMENT,
  ANNUAL_LEAVE_EMP.START_WORKING_DATE,
];

/** Gộp hồ sơ — ưu tiên giá trị đã có, bổ sung từ bản ghi khác / điểm danh. */
export function mergeAnnualLeaveProfileFields(primary = {}, secondary = {}) {
  const left = primary && typeof primary === "object" ? primary : {};
  const right = secondary && typeof secondary === "object" ? secondary : {};

  return {
    [ANNUAL_LEAVE_EMP.MNV_PREFIX]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.MNV_PREFIX],
      right[ANNUAL_LEAVE_EMP.MNV_PREFIX],
      left.mnv,
      right.mnv,
      left[PAYROLL_EMP.MNV],
      right[PAYROLL_EMP.MNV],
    ),
    [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.MNV_SUFFIX],
      right[ANNUAL_LEAVE_EMP.MNV_SUFFIX],
      left.mvt,
      right.mvt,
      left[PAYROLL_EMP.MVT],
      right[PAYROLL_EMP.MVT],
    ),
    [ANNUAL_LEAVE_EMP.FULL_NAME]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.FULL_NAME],
      right[ANNUAL_LEAVE_EMP.FULL_NAME],
      left.hoTen,
      right.hoTen,
      left[PAYROLL_EMP.EMPLOYEE_NAME],
      right[PAYROLL_EMP.EMPLOYEE_NAME],
    ),
    [ANNUAL_LEAVE_EMP.DATE_OF_BIRTH]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH],
      right[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH],
      left.ngaySinh,
      right.ngaySinh,
    ),
    [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT],
      right[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT],
      left.boPhan,
      right.boPhan,
      left[PAYROLL_EMP.DEPARTMENT],
      right[PAYROLL_EMP.DEPARTMENT],
    ),
    [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: pickNonEmpty(
      left[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
      right[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
      left.ngayVaoLam,
      right.ngayVaoLam,
      left[PAYROLL_EMP.JOIN_DATE],
      right[PAYROLL_EMP.JOIN_DATE],
    ),
  };
}

/**
 * Chuẩn hóa hồ sơ NV trên `annualLeave/{year}` — map tên legacy + suy MNV từ `emp_{mnv}`.
 */
export function normalizeAnnualLeaveRawProfile(raw, empKey = "") {
  if (!raw || typeof raw !== "object") return raw;

  const profile = mergeAnnualLeaveProfileFields(raw, {});
  const fromEmpKey = empKey ? mnvFromEmpFirebaseKey(empKey) : "";

  return {
    ...raw,
    ...profile,
    [ANNUAL_LEAVE_EMP.MNV_PREFIX]: pickNonEmpty(
      profile[ANNUAL_LEAVE_EMP.MNV_PREFIX],
      fromEmpKey,
    ),
  };
}

/** Hồ sơ đủ hiển thị lưới — không cần quét điểm danh bổ sung. */
export function annualLeaveRawProfileComplete(raw) {
  if (!raw || typeof raw !== "object") return false;
  return Boolean(
    String(raw[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").trim() &&
      String(raw[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim(),
  );
}

/** Quét snapshot điểm danh — chỉ các `emp_{mnv}` trong scope (vd. trang hiện tại). */
export function buildAttendanceProfileByEmpKey(
  attendanceRoot,
  scopeEmpKeySet = null,
) {
  const map = {};
  if (!attendanceRoot || typeof attendanceRoot !== "object") return map;

  const scope =
    scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0
      ? scopeEmpKeySet
      : null;
  if (scope && scope.size === 0) return map;

  let remaining = scope ? scope.size : 0;

  for (const dateKey of Object.keys(attendanceRoot)) {
    if (scope && remaining === 0) break;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;

    const dayData = attendanceRoot[dateKey];
    if (!dayData || typeof dayData !== "object") continue;

    for (const [empKey, emp] of Object.entries(dayData)) {
      if (scope && !scope.has(empKey)) continue;
      if (!emp || typeof emp !== "object") continue;

      const prev = map[empKey];
      if (prev && annualLeaveRawProfileComplete(prev)) {
        if (scope) remaining -= 1;
        continue;
      }

      const merged = mergeAnnualLeaveProfileFields(prev ?? {}, emp);
      map[empKey] = merged;
      if (scope && annualLeaveRawProfileComplete(merged)) {
        remaining -= 1;
      }
    }
  }

  return map;
}

export function resolveAnnualLeaveRawWithProfiles(raw, empKey, profiles = {}) {
  const normalized = normalizeAnnualLeaveRawProfile(raw, empKey);
  const attendanceProfile = profiles?.[empKey];
  if (!attendanceProfile) return normalized;

  return normalizeAnnualLeaveRawProfile(
    {
      ...normalized,
      ...mergeAnnualLeaveProfileFields(normalized, attendanceProfile),
    },
    empKey,
  );
}
