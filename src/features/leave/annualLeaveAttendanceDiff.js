import { isAttendanceDayMetaKey } from "@/features/attendance/attendanceDayMeta";
import { getAttendanceLeaveTypeRaw } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { attendanceMnvKeyFromDayRecord } from "./annualLeaveBalanceLookup";
import { annualLeaveEmpFirebaseKey } from "./annualLeaveEmpKey";

/** Fingerprint nhẹ — chỉ trường ảnh hưởng trừ phép năm. */
export function annualLeaveDeductionDayFingerprint(dayData) {
  if (!dayData || typeof dayData !== "object") return "";
  const parts = [];
  for (const [empKey, rawEmp] of Object.entries(dayData)) {
    if (isAttendanceDayMetaKey(empKey)) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    const loaiPhep = getAttendanceLeaveTypeRaw(rawEmp) ?? "";
    parts.push(`${empKey}:${loaiPhep}`);
  }
  parts.sort();
  return parts.join("|");
}

function empLeaveFingerprint(empKey, rawEmp) {
  const loaiPhep = getAttendanceLeaveTypeRaw(rawEmp) ?? "";
  return `${empKey}:${loaiPhep}`;
}

function collectChangedEmpFirebaseKeysFromDay(prevDay, nextDay) {
  const keys = new Set();
  const prevParts = new Map();
  const nextParts = new Map();

  for (const [empKey, rawEmp] of Object.entries(prevDay ?? {})) {
    if (isAttendanceDayMetaKey(empKey)) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    prevParts.set(empKey, empLeaveFingerprint(empKey, rawEmp));
  }
  for (const [empKey, rawEmp] of Object.entries(nextDay ?? {})) {
    if (isAttendanceDayMetaKey(empKey)) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    nextParts.set(empKey, empLeaveFingerprint(empKey, rawEmp));
  }

  const allEmpKeys = new Set([...prevParts.keys(), ...nextParts.keys()]);
  for (const empKey of allEmpKeys) {
    if (prevParts.get(empKey) === nextParts.get(empKey)) continue;
    const rawEmp = nextDay?.[empKey] ?? prevDay?.[empKey];
    const mnvKey = attendanceMnvKeyFromDayRecord(empKey, rawEmp);
    const firebaseKey = annualLeaveEmpFirebaseKey(mnvKey);
    if (firebaseKey) keys.add(firebaseKey);
  }
  return keys;
}

function intersectScopeEmpKeys(empKeys, scopeEmpKeySet) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    return empKeys;
  }
  const scoped = new Set();
  for (const empKey of empKeys) {
    if (scopeEmpKeySet.has(empKey)) scoped.add(empKey);
  }
  return scoped;
}

/**
 * So sánh snapshot attendance cả năm — trả ngày đổi + empKey bị ảnh hưởng.
 * Dùng fingerprint theo ngày (không so reference vì Firebase luôn clone mới).
 */
export function diffAttendanceYearSnapshots(
  prevRoot,
  nextRoot,
  year,
  prevFingerprints = null,
) {
  const yearPrefix = `${year}-`;
  const changedDateKeys = new Set();
  const affectedEmpKeys = new Set();

  const next =
    nextRoot && typeof nextRoot === "object" ? nextRoot : {};
  const prev =
    prevRoot && typeof prevRoot === "object" ? prevRoot : {};

  const dateKeys = new Set([
    ...Object.keys(prev),
    ...Object.keys(next),
  ]);

  for (const dateKey of dateKeys) {
    if (!dateKey.startsWith(yearPrefix)) continue;

    const prevFp =
      prevFingerprints?.get(dateKey) ??
      annualLeaveDeductionDayFingerprint(prev[dateKey]);
    const nextFp = annualLeaveDeductionDayFingerprint(next[dateKey]);

    if (prevFp === nextFp) continue;

    changedDateKeys.add(dateKey);
    for (const key of collectChangedEmpFirebaseKeysFromDay(
      prev[dateKey],
      next[dateKey],
    )) {
      affectedEmpKeys.add(key);
    }
  }

  const isInitial = !prevRoot || !prevFingerprints?.size;

  return { changedDateKeys, affectedEmpKeys, isInitial };
}

export { intersectScopeEmpKeys };
