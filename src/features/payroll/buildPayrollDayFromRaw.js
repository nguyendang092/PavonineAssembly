import {
  attendanceDayRowSnapshotEqual,
  mergeAttendanceDayRowsFromRaw,
  reconcileAttendanceDayRowsFromRaw,
} from "@/features/attendance/mergeAttendanceDayRows";
import { businessEmployeeCode } from "@/utils/attendanceEmployeeRecord";
import {
  getEarlyOtPaperworkFromRaw,
  getIsCompensatoryDayFromRaw,
  getIsHolidayDayFromRaw,
  getLateOtPaperworkFromRaw,
  getIsOffDayFromRaw,
} from "@/features/attendance/attendanceDayMeta";

import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

/**
 * Chỉ giữ trường cần cho bảng giờ công tháng — giảm heap khi ghép ~31 ngày.
 * Đồng bộ với `ATTENDANCE_DAY_UI_ROW_KEYS` + cờ payroll OT trên row.
 */
const PAYROLL_MONTH_SLIM_KEYS = [
  PAYROLL_EMP.STT,
  PAYROLL_EMP.MNV,
  PAYROLL_EMP.MVT,
  PAYROLL_EMP.DEPT_CODE,
  PAYROLL_EMP.EMPLOYEE_NAME,
  PAYROLL_EMP.DEPARTMENT,
  PAYROLL_EMP.JOIN_DATE,
  PAYROLL_EMP.CONTRACT_DATE,
  PAYROLL_EMP.TIME_IN,
  PAYROLL_EMP.TIME_OUT,
  PAYROLL_EMP.LUNCH_OT_HOURS,
  PAYROLL_EMP.SHIFT,
  PAYROLL_EMP.LEAVE_TYPE,
  PAYROLL_EMP.COMP_LEAVE_ALLOWED,
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTaiXeInWorkingHours",
  "includeTaiXeTongInWorkingHours",
  "includeTsNvInWorkingHours",
  "payrollEarlyOtPaperwork",
  "payrollLateOtExcluded",
];

function shallowStringRecordEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Giữ reference dòng payroll khi base + cờ TC sớm/muộn không đổi. */
export function reconcilePayrollEmployeesFromBase(
  prevRows,
  baseEmployees,
  earlyOtPaperworkById,
  lateOtExcludedById,
) {
  const prevById = new Map();
  for (const row of prevRows || []) {
    if (row?.id != null) prevById.set(row.id, row);
  }

  const next = baseEmployees.map((e) => {
    const payrollEarlyOtPaperwork = earlyOtPaperworkById[e.id];
    const payrollLateOtExcluded = lateOtExcludedById[e.id];
    const candidate = {
      ...e,
      payrollEarlyOtPaperwork,
      payrollLateOtExcluded,
    };
    const prior = prevById.get(e.id);
    if (
      prior &&
      attendanceDayRowSnapshotEqual(prior, candidate) &&
      prior.payrollEarlyOtPaperwork === payrollEarlyOtPaperwork &&
      prior.payrollLateOtExcluded === payrollLateOtExcluded
    ) {
      return prior;
    }
    return candidate;
  });

  const prev = prevRows || [];
  if (
    prev.length === next.length &&
    prev.every((row, index) => row === next[index])
  ) {
    return prev;
  }
  return next;
}

function sortPayrollEmployeesStable(rows) {
  return [...rows].sort((a, b) => {
    const aStt = Number(a?.stt);
    const bStt = Number(b?.stt);
    const aSttNorm = Number.isFinite(aStt) ? aStt : Number.POSITIVE_INFINITY;
    const bSttNorm = Number.isFinite(bStt) ? bStt : Number.POSITIVE_INFINITY;
    return aSttNorm - bSttNorm;
  });
}

export function slimPayrollMonthEmployeeRecord(emp) {
  if (!emp || typeof emp !== "object") return emp;
  const o = {};
  if (emp.id != null) o.id = emp.id;
  o.monthEmployeeKey = businessEmployeeCode(emp) || String(emp.id ?? "");
  for (const k of PAYROLL_MONTH_SLIM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(emp, k)) o[k] = emp[k];
  }
  return o;
}

/**
 * Chuẩn hóa node `attendance/{ngày}` giống bảng lương (`PayrollSalaryCalculator` + `AttendanceTableRow` payroll).
 *
 * - `baseEmployees`: merge + sanitize — dùng state / form / xuất Excel (kèm `earlyOtPaperworkById` trong ctx).
 * - `payrollEmployees`: mỗi dòng có `payrollEarlyOtPaperwork` như `employeesForPayroll` trên màn lương.
 */
export function parsePayrollDayFromAttendanceRaw(
  raw,
  prevBaseEmployees = [],
  prevPayrollEmployees = [],
) {
  if (raw == null || typeof raw !== "object") {
    return {
      baseEmployees: [],
      payrollEmployees: [],
      isOffDay: false,
      isHolidayDay: false,
      isCompensatoryDay: false,
      isPayrollOffLikeDay: false,
      earlyOtPaperworkById: {},
      lateOtExcludedById: {},
    };
  }
  const isOffDay = getIsOffDayFromRaw(raw);
  const isHolidayDay = getIsHolidayDayFromRaw(raw);
  const isCompensatoryDay = getIsCompensatoryDayFromRaw(raw);
  const earlyOtPaperworkById = getEarlyOtPaperworkFromRaw(raw);
  const lateOtExcludedById = getLateOtPaperworkFromRaw(raw);
  const baseEmployees = sortPayrollEmployeesStable(
    reconcileAttendanceDayRowsFromRaw(prevBaseEmployees, raw),
  );
  const payrollEmployees = reconcilePayrollEmployeesFromBase(
    prevPayrollEmployees,
    baseEmployees,
    earlyOtPaperworkById,
    lateOtExcludedById,
  );
  return {
    baseEmployees,
    payrollEmployees,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
    isPayrollOffLikeDay:
      isOffDay || isHolidayDay || isCompensatoryDay,
    earlyOtPaperworkById,
    lateOtExcludedById,
  };
}

/** Tránh setState map meta khi nội dung không đổi. */
export { shallowStringRecordEqual };

/**
 * Một ngày trong lưới tháng: dòng đã gắn `payrollEarlyOtPaperwork` + map theo id.
 * @returns {null | {
 *   dateKey: string,
 *   employees: object[],
 *   byId: Map<string, object>,
 *   byMonthEmployeeKey: Map<string, object>,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isCompensatoryDay: boolean,
 *   isPayrollOffLikeDay: boolean,
 *   earlyOtPaperworkById: Record<string, boolean>,
 *   lateOtExcludedById: Record<string, boolean>,
 * }}
 */
export function buildPayrollMonthDayChunkFromRaw(raw, dateKey) {
  const parsed = parsePayrollDayFromAttendanceRaw(raw);
  const slimEmployees = parsed.payrollEmployees.map((e) =>
    slimPayrollMonthEmployeeRecord(e),
  );
  /** `_meta` off / lễ / nghỉ bù — chunk để đổi màu cột và tính Số ngày công. */
  const hasMetaCalendarFlags =
    parsed.isOffDay ||
    parsed.isHolidayDay ||
    parsed.isCompensatoryDay;
  if (!slimEmployees.length && !hasMetaCalendarFlags) return null;
  return {
    dateKey,
    employees: slimEmployees,
    byId: new Map(slimEmployees.map((e) => [e.id, e])),
    byMonthEmployeeKey: new Map(
      slimEmployees.map((e) => [e.monthEmployeeKey || e.id, e]),
    ),
    isOffDay: parsed.isOffDay,
    isHolidayDay: parsed.isHolidayDay,
    isCompensatoryDay: parsed.isCompensatoryDay,
    isPayrollOffLikeDay: parsed.isPayrollOffLikeDay,
    earlyOtPaperworkById: parsed.earlyOtPaperworkById,
    lateOtExcludedById: parsed.lateOtExcludedById,
  };
}
