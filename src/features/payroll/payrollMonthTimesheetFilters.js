import { getAttendanceLeaveTypeRaw } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { employeeHasPayrollOvertimeHours } from "@/features/attendance/attendanceDayMeta";
import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import { resolvePayrollMonthDayEmployee } from "@/features/payroll/payrollMonthlyGridData";
import { resolveEffectivePayrollEarlyOtPaperwork } from "@/features/payroll/payrollEarlyOtMeta";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

export const PAYROLL_TIMESHEET_PRESENCE_FILTER = Object.freeze({
  ALL: "all",
  WITH: "with",
  WITHOUT: "without",
});

export function matchesPayrollMonthTimesheetPresenceFilter(
  flags,
  {
    workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  } = {},
) {
  if (workHoursFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH && !flags?.hasWorkHours) {
    return false;
  }
  if (
    workHoursFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT &&
    flags?.hasWorkHours
  ) {
    return false;
  }
  if (leaveTypeFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH && !flags?.hasLeaveType) {
    return false;
  }
  if (
    leaveTypeFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT &&
    flags?.hasLeaveType
  ) {
    return false;
  }
  if (overtimeFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH && !flags?.hasOvertime) {
    return false;
  }
  if (
    overtimeFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT &&
    flags?.hasOvertime
  ) {
    return false;
  }
  return true;
}

export function needsPayrollMonthTimesheetPresenceFlags({
  workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
} = {}) {
  return (
    workHoursFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL ||
    leaveTypeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL ||
    overtimeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL
  );
}

/**
 * Quét tháng theo NV — dùng cho bộ lọc «có/không giờ công» và «có/không loại phép».
 */
export function buildPayrollMonthTimesheetFlagsById({
  monthKeys = [],
  chunkByDate,
  sortedIds = [],
  repById,
}) {
  const map = new Map();

  for (const id of sortedIds) {
    const rep = repById?.get(id);
    let hasLeaveType = false;
    let hasOvertime = false;

    for (const dateKey of monthKeys) {
      const ch = chunkByDate?.get(dateKey);
      if (!ch) continue;
      const emp = resolvePayrollMonthDayEmployee(ch, id, rep);
      if (!emp) continue;

      if (!hasLeaveType && String(getAttendanceLeaveTypeRaw(emp) ?? "").trim()) {
        hasLeaveType = true;
      }

      if (!hasOvertime) {
        const empForOt = {
          ...emp,
          [PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK]:
            resolveEffectivePayrollEarlyOtPaperwork(
              emp,
              ch.earlyOtPaperworkById?.[id],
            ),
          [PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED]:
            emp[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED] ??
            ch.lateOtExcludedById?.[id],
        };
        if (
          employeeHasPayrollOvertimeHours(empForOt, {
            isOffDay: ch.isOffDay,
            isHolidayDay: ch.isHolidayDay,
            isCompensatoryDay: ch.isCompensatoryDay,
            dateKey,
          })
        ) {
          hasOvertime = true;
        }
      }

      if (hasLeaveType && hasOvertime) break;
    }

    const { total } = buildMonthlyRuleSummary(
      chunkByDate,
      monthKeys,
      id,
      rep ?? {},
    );

    map.set(id, {
      hasWorkHours: Number(total?.workHours ?? 0) > 0,
      hasLeaveType,
      hasOvertime,
    });
  }

  return map;
}
