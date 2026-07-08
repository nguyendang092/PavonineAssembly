import {
  isAttendanceDayMetaKey,
  isCompensatoryNbVisibleForDayContext,
} from "@/features/attendance/attendanceDayMeta";
import { pickAttendanceEmployeeDayFields } from "@/features/attendance/attendanceEmployeeFields";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { attendanceMnvKeyFromDayRecord } from "./annualLeaveBalanceLookup";
import { annualLeaveEmpFirebaseKey } from "./annualLeaveEmpKey";

function normalizeAttendanceTimeFilter(third) {
  if (third == null) return {};
  if (typeof third === "string") return { yearMonthPrefix: third };
  return third;
}

function resolveAttendanceDayRecordForEmpKey(dayData, targetEmpKey) {
  if (!dayData || typeof dayData !== "object" || !targetEmpKey) return null;

  if (dayData[targetEmpKey] && typeof dayData[targetEmpKey] === "object") {
    return dayData[targetEmpKey];
  }

  for (const [recordKey, rawEmp] of Object.entries(dayData)) {
    if (isAttendanceDayMetaKey(recordKey)) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    const mnvKey = attendanceMnvKeyFromDayRecord(recordKey, rawEmp);
    if (annualLeaveEmpFirebaseKey(mnvKey) === targetEmpKey) return rawEmp;
  }

  return null;
}

function attendanceDayHasSignal(fields) {
  return Boolean(
    String(fields.timeIn ?? "").trim() ||
      String(fields.timeOut ?? "").trim() ||
      String(fields.leaveType ?? "").trim() ||
      String(fields.shiftCode ?? "").trim(),
  );
}

function formatTimeOutDisplay(raw) {
  return formatAttendanceTimeInColumnDisplay(raw) || "—";
}

function formatTimeInDisplay(raw) {
  return formatAttendanceTimeInColumnDisplay(raw) || "—";
}

function resolveLeaveTypeForTimeRow(raw, compensatoryNb) {
  const formatted = raw
    ? formatAttendanceLeaveTypeColumnForEmployee(raw) || ""
    : "";
  if (formatted) return formatted;
  return compensatoryNb ? "NB" : "—";
}

/**
 * Dòng giờ vào/ra theo ngày từ snapshot điểm danh cả năm — một `emp_{mnv}`.
 * Ngày nghỉ bù lịch (`_meta.isCompensatoryDay`) hiển thị NB khi được phép; NV loại trừ NB.
 * @returns {Array<{ dateKey: string, timeIn: string, timeOut: string, leaveType: string, shift: string }>}
 */
export function buildEmployeeAttendanceTimeRows(
  attendanceRootData,
  year,
  empKey,
  filterOrYearMonth = null,
) {
  const targetKey = String(empKey ?? "").trim();
  if (!targetKey) return [];

  const { yearMonthPrefix = null, throughDateKey = null } =
    normalizeAttendanceTimeFilter(filterOrYearMonth);

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

  if (!attendanceRootData || typeof attendanceRootData !== "object") return [];

  const rows = [];

  for (const [dateKey, dayData] of Object.entries(attendanceRootData)) {
    if (!dateKey.startsWith(yearPrefix)) continue;
    if (monthPrefix && !dateKey.startsWith(monthPrefix)) continue;
    if (through && dateKey > through) continue;
    if (!dayData || typeof dayData !== "object") continue;

    const raw = resolveAttendanceDayRecordForEmpKey(dayData, targetKey);
    const compensatoryNb = isCompensatoryNbVisibleForDayContext(dayData, raw);
    const fields = raw ? pickAttendanceEmployeeDayFields(raw) : null;
    const hasSignal = fields && attendanceDayHasSignal(fields);

    if (!hasSignal && !compensatoryNb) continue;

    rows.push({
      dateKey,
      timeIn: fields ? formatTimeInDisplay(fields.timeIn) : "—",
      timeOut: fields ? formatTimeOutDisplay(fields.timeOut) : "—",
      leaveType: resolveLeaveTypeForTimeRow(raw, compensatoryNb),
      shift: fields ? String(fields.shiftCode ?? "").trim() || "—" : "—",
    });
  }

  rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return rows;
}
