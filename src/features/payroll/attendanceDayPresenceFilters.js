import { getAttendanceLeaveTypeRaw } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { employeeHasPayrollOvertimeHours } from "@/features/attendance/attendanceDayMeta";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { getAttendanceWorkingHoursHours } from "@/features/attendance/attendanceWorkingHours";
import {
  hasPayrollShortWorkHoursFlag,
  isPayrollUnderStandardWorkHours,
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";

export {
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
  isPayrollUnderStandardWorkHours,
  hasPayrollShortWorkHoursFlag,
};

/** Có/không giờ công, loại phép, tăng ca & giờ công < 8 trên **một ngày** (bảng Xem giờ công). */
export function getAttendanceDayEmployeePresenceFlags(emp, dayCtx = {}) {
  const hasLeaveType = Boolean(
    String(getAttendanceLeaveTypeRaw(emp) ?? "").trim(),
  );
  const flags = employeeRegimeWorkingHoursFlags(emp);
  const hours = getAttendanceWorkingHoursHours(
    emp?.gioVao,
    emp?.gioRa,
    emp?.caLamViec,
    flags.includeTapVuInWorkingHours,
    flags.includeThaiSanInWorkingHours,
    flags.includeTaiXeInWorkingHours,
    flags.includeTaiXeTongInWorkingHours,
  );
  const hasWorkHours = Number.isFinite(hours) && hours > 0;
  const hasOvertime = employeeHasPayrollOvertimeHours(emp, dayCtx);
  const hasShortHours = hasPayrollShortWorkHoursFlag(
    hours,
    getAttendanceLeaveTypeRaw(emp),
  );

  return { hasWorkHours, hasLeaveType, hasOvertime, hasShortHours };
}
