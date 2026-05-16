import { mergeAttendanceDayRowsFromRaw } from "@/features/attendance/mergeAttendanceDayRows";
import { businessEmployeeCode } from "@/utils/attendanceEmployeeRecord";
import {
  getEarlyOtPaperworkFromRaw,
  getIsCompensatoryDayFromRaw,
  getIsHolidayDayFromRaw,
  getLateOtPaperworkFromRaw,
  getIsOffDayFromRaw,
} from "@/features/attendance/attendanceDayMeta";

/** Chỉ giữ trường cần cho bảng giờ công tháng — giảm heap khi ghép ~31 ngày. */
const PAYROLL_MONTH_SLIM_KEYS = [
  "stt",
  "mnv",
  "mvt",
  "maBoPhan",
  "hoVaTen",
  "boPhan",
  "ngayVaoLam",
  "ngayHopDong",
  "gioVao",
  "gioRa",
  "caLamViec",
  "loaiPhep",
  "duocNghiBu",
  "includeTapVuInWorkingHours",
  "includeThaiSanInWorkingHours",
  "includeTsNvInWorkingHours",
  "payrollEarlyOtPaperwork",
  "payrollLateOtExcluded",
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
    mergeAttendanceDayRowsFromRaw(raw),
  );
  const payrollEmployees = baseEmployees.map((e) => ({
    ...e,
    payrollEarlyOtPaperwork: earlyOtPaperworkById[e.id],
    payrollLateOtExcluded: lateOtExcludedById[e.id],
  }));
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
