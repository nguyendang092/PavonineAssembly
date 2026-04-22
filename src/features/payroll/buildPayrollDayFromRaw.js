import { mergeAttendanceDayRowsFromRaw } from "@/features/attendance/mergeAttendanceDayRows";
import {
  getEarlyOtPaperworkFromRaw,
  getIsHolidayDayFromRaw,
  getIsOffDayFromRaw,
} from "@/features/attendance/attendanceDayMeta";

/**
 * Chuẩn hóa node `attendance/{ngày}` giống bảng lương (`PayrollSalaryCalculator` + `AttendanceTableRow` payroll).
 *
 * - `baseEmployees`: merge + sanitize — dùng state / form / xuất Excel (kèm `earlyOtPaperworkById` trong ctx).
 * - `payrollEmployees`: mỗi dòng có `payrollEarlyOtPaperwork` như `employeesForPayroll` trên màn lương.
 */
export function parsePayrollDayFromAttendanceRaw(raw) {
  if (raw == null || typeof raw !== "object") {
    return {
      baseEmployees: [],
      payrollEmployees: [],
      isOffDay: false,
      isHolidayDay: false,
      isPayrollOffLikeDay: false,
      earlyOtPaperworkById: {},
    };
  }
  const isOffDay = getIsOffDayFromRaw(raw);
  const isHolidayDay = getIsHolidayDayFromRaw(raw);
  const earlyOtPaperworkById = getEarlyOtPaperworkFromRaw(raw);
  const baseEmployees = mergeAttendanceDayRowsFromRaw(raw);
  const payrollEmployees = baseEmployees.map((e) => ({
    ...e,
    payrollEarlyOtPaperwork: earlyOtPaperworkById[e.id],
  }));
  return {
    baseEmployees,
    payrollEmployees,
    isOffDay,
    isHolidayDay,
    isPayrollOffLikeDay: isOffDay || isHolidayDay,
    earlyOtPaperworkById,
  };
}

/**
 * Một ngày trong lưới tháng: dòng đã gắn `payrollEarlyOtPaperwork` + map theo id.
 * @returns {null | {
 *   dateKey: string,
 *   employees: object[],
 *   byId: Map<string, object>,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isPayrollOffLikeDay: boolean,
 *   earlyOtPaperworkById: Record<string, boolean>,
 * }}
 */
export function buildPayrollMonthDayChunkFromRaw(raw, dateKey) {
  const parsed = parsePayrollDayFromAttendanceRaw(raw);
  if (!parsed.payrollEmployees.length) return null;
  return {
    dateKey,
    employees: parsed.payrollEmployees,
    byId: new Map(parsed.payrollEmployees.map((e) => [e.id, e])),
    isOffDay: parsed.isOffDay,
    isHolidayDay: parsed.isHolidayDay,
    isPayrollOffLikeDay: parsed.isPayrollOffLikeDay,
    earlyOtPaperworkById: parsed.earlyOtPaperworkById,
  };
}
