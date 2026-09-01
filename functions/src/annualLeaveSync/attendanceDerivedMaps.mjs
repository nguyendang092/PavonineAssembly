import {
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
} from "./fields.mjs";
import {
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
  roundAnnualLeaveHours,
} from "./deduction.mjs";
import {
  annualLeaveEmpFirebaseKey,
  attendanceMnvKeyFromDayRecord,
} from "./empKey.mjs";

const ATTENDANCE_DAY_META_KEY = "_meta";

function isAttendanceDateKey(dateKey) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey ?? ""));
}

function ensureAttendanceMonthlyTotalsRow(map, empKey) {
  if (!map[empKey]) {
    map[empKey] = Array.from({ length: 12 }, () => 0);
  }
  return map[empKey];
}

function addAttendanceMonthlyTotal(monthRow, monthIndex, deduction) {
  if (monthIndex < 0 || monthIndex > 11) return;
  monthRow[monthIndex] = roundAnnualLeaveHours(
    (monthRow[monthIndex] ?? 0) + deduction,
  );
}

function forEachAttendanceDayEmployee(dayData, iterate) {
  if (!dayData || typeof dayData !== "object") return;
  for (const [recordKey, rawEmp] of Object.entries(dayData)) {
    if (recordKey === ATTENDANCE_DAY_META_KEY) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    iterate(recordKey, rawEmp);
  }
}

/**
 * Quét attendance một lần — tổng năm + mảng 12 tháng theo `emp_{mnv}`.
 * @returns {{ deductionsByEmpKey: Record<string, number>, attendanceMonthlyByEmpKey: Record<string, number[]> }}
 */
export function buildAttendanceAnnualLeaveDerivedMaps(attendanceRootData, year) {
  const deductionsByEmpKey = {};
  const attendanceMonthlyByEmpKey = {};
  if (!attendanceRootData || typeof attendanceRootData !== "object") {
    return { deductionsByEmpKey, attendanceMonthlyByEmpKey };
  }

  const yearPrefix = `${year}-`;

  for (const [dateKey, dayData] of Object.entries(attendanceRootData)) {
    if (!isAttendanceDateKey(dateKey) || !dateKey.startsWith(yearPrefix)) {
      continue;
    }

    const counted = isAttendanceDateCountedForAnnualLeave(dateKey, year);
    const displayOnly = isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year);
    if (!counted && !displayOnly) continue;

    const monthIndex = Number(dateKey.slice(5, 7)) - 1;

    forEachAttendanceDayEmployee(dayData, (recordKey, rawEmp) => {
      const mnvKey = attendanceMnvKeyFromDayRecord(recordKey, rawEmp);
      if (!mnvKey) return;

      const deduction = attendanceAnnualLeaveDeductionForLoaiPhep(
        attendanceEffectiveLoaiPhepFromRaw(rawEmp),
      );
      if (deduction === 0) return;

      const firebaseKey = annualLeaveEmpFirebaseKey(mnvKey);
      if (!firebaseKey) return;

      const monthRow = ensureAttendanceMonthlyTotalsRow(
        attendanceMonthlyByEmpKey,
        firebaseKey,
      );
      addAttendanceMonthlyTotal(monthRow, monthIndex, deduction);

      if (displayOnly) return;

      deductionsByEmpKey[firebaseKey] = roundAnnualLeaveHours(
        (deductionsByEmpKey[firebaseKey] ?? 0) + deduction,
      );
    });
  }

  return { deductionsByEmpKey, attendanceMonthlyByEmpKey };
}
