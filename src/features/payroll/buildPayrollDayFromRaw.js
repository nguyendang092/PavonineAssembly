import { mergeAttendanceDayRowsFromRaw } from "@/features/attendance/mergeAttendanceDayRows";
import { businessEmployeeCode } from "@/utils/employeeRosterRecord";
import {
  getEarlyOtPaperworkFromRaw,
  getIsHolidayDayFromRaw,
  getLateOtPaperworkFromRaw,
  getIsOffDayFromRaw,
} from "@/features/attendance/attendanceDayMeta";

/** Chỉ giữ trường cần cho bảng giờ công tháng — giảm heap khi ghép ~31 ngày. */
const PAYROLL_MONTH_SLIM_KEYS = [
  "stt",
  "mnv",
  "hoVaTen",
  "boPhan",
  "ngayVaoLam",
  "trangThaiLamViec",
  "gioVao",
  "gioRa",
  "caLamViec",
  "loaiPhep",
  "payrollEarlyOtPaperwork",
];

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
export function parsePayrollDayFromAttendanceRaw(raw) {
  if (raw == null || typeof raw !== "object") {
    return {
      baseEmployees: [],
      payrollEmployees: [],
      isOffDay: false,
      isHolidayDay: false,
      isPayrollOffLikeDay: false,
      earlyOtPaperworkById: {},
      lateOtPaperworkById: {},
    };
  }
  const isOffDay = getIsOffDayFromRaw(raw);
  const isHolidayDay = getIsHolidayDayFromRaw(raw);
  const earlyOtPaperworkById = getEarlyOtPaperworkFromRaw(raw);
  const lateOtPaperworkById = getLateOtPaperworkFromRaw(raw);
  const baseEmployees = sortPayrollEmployeesStable(
    mergeAttendanceDayRowsFromRaw(raw),
  );
  const payrollEmployees = baseEmployees.map((e) => ({
    ...e,
    payrollEarlyOtPaperwork: earlyOtPaperworkById[e.id],
    payrollLateOtPaperwork: lateOtPaperworkById[e.id],
  }));
  return {
    baseEmployees,
    payrollEmployees,
    isOffDay,
    isHolidayDay,
    isPayrollOffLikeDay: isOffDay || isHolidayDay,
    earlyOtPaperworkById,
    lateOtPaperworkById,
  };
}

/**
 * Một ngày trong lưới tháng: dòng đã gắn `payrollEarlyOtPaperwork` + map theo id.
 * @returns {null | {
 *   dateKey: string,
 *   employees: object[],
 *   byId: Map<string, object>,
 *   byMonthEmployeeKey: Map<string, object>,
 *   isOffDay: boolean,
 *   isHolidayDay: boolean,
 *   isPayrollOffLikeDay: boolean,
 *   earlyOtPaperworkById: Record<string, boolean>,
 *   lateOtPaperworkById: Record<string, boolean>,
 * }}
 */
export function buildPayrollMonthDayChunkFromRaw(raw, dateKey) {
  const parsed = parsePayrollDayFromAttendanceRaw(raw);
  if (!parsed.payrollEmployees.length) return null;
  const slimEmployees = parsed.payrollEmployees.map((e) =>
    slimPayrollMonthEmployeeRecord(e),
  );
  return {
    dateKey,
    employees: slimEmployees,
    byId: new Map(slimEmployees.map((e) => [e.id, e])),
    byMonthEmployeeKey: new Map(
      slimEmployees.map((e) => [e.monthEmployeeKey || e.id, e]),
    ),
    isOffDay: parsed.isOffDay,
    isHolidayDay: parsed.isHolidayDay,
    isPayrollOffLikeDay: parsed.isPayrollOffLikeDay,
    earlyOtPaperworkById: parsed.earlyOtPaperworkById,
    lateOtPaperworkById: parsed.lateOtPaperworkById,
  };
}
