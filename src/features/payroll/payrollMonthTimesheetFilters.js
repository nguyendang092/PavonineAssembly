import { getAttendanceLeaveTypeRaw } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { employeeHasPayrollOvertimeHours, isAttendanceHalfPnLeaveType } from "@/features/attendance/attendanceDayMeta";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import { getAttendanceWorkingHoursHours } from "@/features/attendance/attendanceWorkingHours";
import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  comparePayrollMonthRowsByDepartment,
  matchesPayrollMonthRowFilter,
  resolvePayrollMonthDayEmployee,
} from "@/features/payroll/payrollMonthlyGridData";
import { resolveEffectivePayrollEarlyOtPaperwork } from "@/features/payroll/payrollEarlyOtMeta";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";

export const PAYROLL_TIMESHEET_PRESENCE_FILTER = Object.freeze({
  ALL: "all",
  WITH: "with",
  WITHOUT: "without",
});

/** Giờ công chuẩn ca ngày — dùng lọc «đi trễ về sớm» (< 8h). */
export const PAYROLL_STANDARD_DAY_WORK_HOURS = 8;

export const PAYROLL_SHORT_HOURS_FILTER = Object.freeze({
  ALL: "all",
  UNDER_STANDARD: "underStandard",
});

export function isPayrollUnderStandardWorkHours(hours) {
  return (
    Number.isFinite(hours) &&
    hours > 0 &&
    hours < PAYROLL_STANDARD_DAY_WORK_HOURS
  );
}

/** Giờ công < 8 — loại trừ nửa ngày phép năm (1/2PN). */
export function hasPayrollShortWorkHoursFlag(hours, leaveType) {
  if (isAttendanceHalfPnLeaveType(leaveType)) return false;
  return isPayrollUnderStandardWorkHours(hours);
}

export function matchesPayrollMonthTimesheetPresenceFilter(
  flags,
  {
    workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    shortHoursFilter = PAYROLL_SHORT_HOURS_FILTER.ALL,
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
  if (
    shortHoursFilter === PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD &&
    !flags?.hasShortHours
  ) {
    return false;
  }
  return true;
}

/** Lọc + sắp xếp danh sách NV cho lưới tháng / xuất Excel. */
export function filterPayrollMonthTimesheetRowIds({
  sortedIds = [],
  repById,
  searchTerm = "",
  departmentFilters,
  normalizeDepartment,
  needsPresenceFlags = false,
  presenceFlagsById = null,
  presenceFilters = {},
}) {
  return sortedIds
    .filter((id) => {
      const rep = repById?.get(id);
      if (
        !rep ||
        !matchesPayrollMonthRowFilter(rep, {
          searchTerm,
          departmentFilters,
          normalizeDepartment,
        })
      ) {
        return false;
      }
      if (!needsPresenceFlags) return true;
      return matchesPayrollMonthTimesheetPresenceFilter(
        presenceFlagsById?.get(id),
        presenceFilters,
      );
    })
    .sort((a, b) =>
      comparePayrollMonthRowsByDepartment(repById.get(a), repById.get(b)),
    );
}

export function needsPayrollMonthTimesheetPresenceFlags({
  workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  shortHoursFilter = PAYROLL_SHORT_HOURS_FILTER.ALL,
} = {}) {
  return (
    workHoursFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL ||
    leaveTypeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL ||
    overtimeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL ||
    shortHoursFilter !== PAYROLL_SHORT_HOURS_FILTER.ALL
  );
}

/** Số bộ lọc đang bật (khác «Tất cả») — badge trên nút Bộ lọc. */
export function countActivePayrollTimesheetPresenceFilters({
  workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  shortHoursFilter = PAYROLL_SHORT_HOURS_FILTER.ALL,
} = {}) {
  let count = 0;
  if (workHoursFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL) count += 1;
  if (leaveTypeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL) count += 1;
  if (overtimeFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL) count += 1;
  if (shortHoursFilter !== PAYROLL_SHORT_HOURS_FILTER.ALL) count += 1;
  return count;
}

/**
 * Quét tháng theo NV — dùng cho bộ lọc «có/không giờ công» và «có/không loại phép».
 */
export function buildPayrollMonthTimesheetFlagsById({
  monthKeys = [],
  chunkByDate,
  sortedIds = [],
  repById,
  resolveWorkHours = true,
}) {
  const map = new Map();

  for (const id of sortedIds) {
    const rep = repById?.get(id);
    let hasLeaveType = false;
    let hasOvertime = false;
    let hasShortHours = false;

    for (const dateKey of monthKeys) {
      const ch = chunkByDate?.get(dateKey);
      if (!ch) continue;
      const emp = resolvePayrollMonthDayEmployee(ch, id, rep);
      if (!emp) continue;

      if (!hasLeaveType && String(getAttendanceLeaveTypeRaw(emp) ?? "").trim()) {
        hasLeaveType = true;
      }

      if (!hasShortHours) {
        const regimeFlags = employeeRegimeWorkingHoursFlags(emp);
        const dayHours = getAttendanceWorkingHoursHours(
          emp?.gioVao,
          emp?.gioRa,
          emp?.caLamViec,
          regimeFlags.includeTapVuInWorkingHours,
          regimeFlags.includeThaiSanInWorkingHours,
          regimeFlags.includeTaiXeInWorkingHours,
          regimeFlags.includeTaiXeTongInWorkingHours,
        );
        if (
          hasPayrollShortWorkHoursFlag(dayHours, getAttendanceLeaveTypeRaw(emp))
        ) {
          hasShortHours = true;
        }
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

      if (hasLeaveType && hasOvertime && hasShortHours) break;
    }

    let hasWorkHours = false;
    if (resolveWorkHours) {
      const { total } = buildMonthlyRuleSummary(
        chunkByDate,
        monthKeys,
        id,
        rep ?? {},
      );
      hasWorkHours = Number(total?.workHours ?? 0) > 0;
    }

    map.set(id, {
      hasWorkHours,
      hasLeaveType,
      hasOvertime,
      hasShortHours,
    });
  }

  return map;
}
