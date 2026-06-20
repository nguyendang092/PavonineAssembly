import { attendanceMnvStorageKey } from "@/utils/attendanceEmployeeRecord";
import {
  canonicalAttendanceLoaiPhepValue,
  getAttendanceLeaveTypeRaw,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { isAttendanceDayMetaKey } from "@/features/attendance/attendanceDayMeta";
import { isAttendanceDateCountedForAnnualLeave, listAnnualLeaveDetailDisplayMonths } from "./annualLeaveFields";
import {
  annualLeaveEmpFirebaseKey,
  annualLeaveFirebaseKeyForMnv,
} from "./annualLeaveEmpKey";
import { roundAnnualLeaveHours } from "./annualLeaveCalculated";

export { annualLeaveFirebaseKeyForMnv } from "./annualLeaveEmpKey";

/** Loại phép hiệu lực từ node ngày (loaiPhep, phepNam, chamCong…). */
export function attendanceEffectiveLoaiPhepFromRaw(raw) {
  return getAttendanceLeaveTypeRaw(raw);
}

export function annualLeaveYearFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return new Date().getFullYear();
  const y = Number(dateKey.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

/** PN −1, 1/2PN −0.5. */
export function attendanceAnnualLeaveDeductionForLoaiPhep(loaiPhep) {
  const canon = canonicalAttendanceLoaiPhepValue(loaiPhep);
  if (canon === "Phép năm") return 1;
  if (canon === "1/2 Phép năm") return 0.5;
  return 0;
}

/** MNV từ cột `mnv` hoặc khóa Firebase `emp_{mnv}`. */
export function attendanceMnvKeyFromDayRecord(empKey, rawEmp) {
  const fromField = attendanceMnvStorageKey(rawEmp?.mnv);
  if (fromField) return fromField;
  const key = String(empKey ?? "").trim();
  if (key.startsWith("emp_")) {
    return attendanceMnvStorageKey(key.slice(4));
  }
  return attendanceMnvStorageKey(key);
}

function normalizeAttendanceLeaveDeductionFilter(third) {
  if (third == null) return {};
  if (typeof third === "string") return { yearMonthPrefix: third };
  return third;
}

/**
 * Tổng PN/1/2PN từ điểm danh — map `emp_{mnv}` → số ngày phép.
 * Filter: `yearMonthPrefix` (`yyyy-mm`) hoặc `throughDateKey` (`yyyy-mm-dd`, lũy kế).
 */
export function buildAttendanceAnnualLeaveDeductionsByMnv(
  attendanceRootData,
  year,
  filterOrYearMonth = null,
) {
  const { yearMonthPrefix = null, throughDateKey = null } =
    normalizeAttendanceLeaveDeductionFilter(filterOrYearMonth);

  const map = {};
  if (!attendanceRootData || typeof attendanceRootData !== "object") return map;

  const yearPrefix = `${year}-`;
  const monthPrefix =
    yearMonthPrefix &&
    String(yearMonthPrefix).startsWith(yearPrefix) &&
    /^\d{4}-\d{2}$/.test(String(yearMonthPrefix))
      ? `${yearMonthPrefix}-`
      : null;
  const through =
    throughDateKey &&
    String(throughDateKey).startsWith(yearPrefix) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
      ? String(throughDateKey)
      : null;

  for (const [dateKey, dayData] of Object.entries(attendanceRootData)) {
    if (!dateKey.startsWith(yearPrefix)) continue;
    if (monthPrefix && !dateKey.startsWith(monthPrefix)) continue;
    if (through && dateKey > through) continue;
    if (!isAttendanceDateCountedForAnnualLeave(dateKey, year)) continue;
    if (!dayData || typeof dayData !== "object") continue;

    for (const [empKey, rawEmp] of Object.entries(dayData)) {
      if (isAttendanceDayMetaKey(empKey)) continue;
      if (!rawEmp || typeof rawEmp !== "object") continue;

      const mnvKey = attendanceMnvKeyFromDayRecord(empKey, rawEmp);
      if (!mnvKey) continue;

      const deduction = attendanceAnnualLeaveDeductionForLoaiPhep(
        attendanceEffectiveLoaiPhepFromRaw(rawEmp),
      );
      if (deduction === 0) continue;

      const firebaseKey = annualLeaveEmpFirebaseKey(mnvKey);
      if (!firebaseKey) continue;

      map[firebaseKey] = roundAnnualLeaveHours(
        (map[firebaseKey] ?? 0) + deduction,
      );
    }
  }

  return map;
}

function emptyAnnualLeaveUsageMonth(yearMonth) {
  return {
    yearMonth,
    pnCount: 0,
    halfPnCount: 0,
    totalDeduction: 0,
    days: [],
  };
}

function fillAnnualLeaveUsageDetailMonths(empDetail, year, filterOrYearMonth) {
  const { throughDateKey = null } = normalizeAttendanceLeaveDeductionFilter(
    filterOrYearMonth,
  );
  const monthKeys = listAnnualLeaveDetailDisplayMonths(year, throughDateKey);
  if (!monthKeys.length) return;

  const monthList = Array.isArray(empDetail.months)
    ? empDetail.months
    : Object.values(empDetail.months);
  const byMonth = {};
  for (const month of monthList) {
    byMonth[month.yearMonth] = month;
  }

  empDetail.months = monthKeys.map(
    (yearMonth) => byMonth[yearMonth] ?? emptyAnnualLeaveUsageMonth(yearMonth),
  );
}

/**
 * Chi tiết PN / 1/2PN theo tháng từ điểm danh — map `emp_{mnv}` → breakdown.
 * Filter giống `buildAttendanceAnnualLeaveDeductionsByMnv`.
 */
export function buildAttendanceAnnualLeaveUsageDetailByEmpKey(
  attendanceRootData,
  year,
  filterOrYearMonth = null,
) {
  const { yearMonthPrefix = null, throughDateKey = null } =
    normalizeAttendanceLeaveDeductionFilter(filterOrYearMonth);

  const map = {};
  if (!attendanceRootData || typeof attendanceRootData !== "object") return map;

  const yearPrefix = `${year}-`;
  const monthPrefix =
    yearMonthPrefix &&
    String(yearMonthPrefix).startsWith(yearPrefix) &&
    /^\d{4}-\d{2}$/.test(String(yearMonthPrefix))
      ? `${yearMonthPrefix}-`
      : null;
  const through =
    throughDateKey &&
    String(throughDateKey).startsWith(yearPrefix) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
      ? String(throughDateKey)
      : null;

  for (const [dateKey, dayData] of Object.entries(attendanceRootData)) {
    if (!dateKey.startsWith(yearPrefix)) continue;
    if (monthPrefix && !dateKey.startsWith(monthPrefix)) continue;
    if (through && dateKey > through) continue;
    if (!isAttendanceDateCountedForAnnualLeave(dateKey, year)) continue;
    if (!dayData || typeof dayData !== "object") continue;

    for (const [empKey, rawEmp] of Object.entries(dayData)) {
      if (isAttendanceDayMetaKey(empKey)) continue;
      if (!rawEmp || typeof rawEmp !== "object") continue;

      const mnvKey = attendanceMnvKeyFromDayRecord(empKey, rawEmp);
      if (!mnvKey) continue;

      const loaiPhep = attendanceEffectiveLoaiPhepFromRaw(rawEmp);
      const deduction = attendanceAnnualLeaveDeductionForLoaiPhep(loaiPhep);
      if (deduction === 0) continue;

      const firebaseKey = annualLeaveEmpFirebaseKey(mnvKey);
      if (!firebaseKey) continue;

      const type = deduction === 1 ? "PN" : "1/2PN";
      const yearMonth = dateKey.slice(0, 7);

      if (!map[firebaseKey]) {
        map[firebaseKey] = {
          totalPn: 0,
          totalHalfPn: 0,
          totalDeduction: 0,
          months: {},
        };
      }

      const empDetail = map[firebaseKey];
      if (!empDetail.months[yearMonth]) {
        empDetail.months[yearMonth] = {
          yearMonth,
          pnCount: 0,
          halfPnCount: 0,
          totalDeduction: 0,
          days: [],
        };
      }

      const monthDetail = empDetail.months[yearMonth];
      if (deduction === 1) {
        empDetail.totalPn += 1;
        monthDetail.pnCount += 1;
      } else {
        empDetail.totalHalfPn += 1;
        monthDetail.halfPnCount += 1;
      }

      empDetail.totalDeduction = roundAnnualLeaveHours(
        empDetail.totalDeduction + deduction,
      );
      monthDetail.totalDeduction = roundAnnualLeaveHours(
        monthDetail.totalDeduction + deduction,
      );
      monthDetail.days.push({ dateKey, type, deduction });
    }
  }

  for (const empDetail of Object.values(map)) {
    fillAnnualLeaveUsageDetailMonths(empDetail, year, filterOrYearMonth);
    for (const monthDetail of empDetail.months) {
      monthDetail.days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
  }

  return map;
}

/** Tra BALANCE theo `emp_{mnv}`. */
export function getAnnualLeaveBalanceForEmployee(emp, balanceByEmpKey) {
  if (!balanceByEmpKey || !emp) return null;

  const mnvKey = attendanceMnvStorageKey(emp.mnv);
  if (!mnvKey) return null;

  const empKey = annualLeaveEmpFirebaseKey(mnvKey);
  if (!empKey) return null;

  const balance = balanceByEmpKey[empKey];
  return balance != null && balance !== undefined ? balance : null;
}

export function getDisplayAnnualLeaveBalanceForAttendance(emp, balanceByEmpKey) {
  return getAnnualLeaveBalanceForEmployee(emp, balanceByEmpKey);
}
