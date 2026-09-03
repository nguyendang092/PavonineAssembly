import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  getAttendanceLeaveTypeRaw,
  rawMatchesAttendanceTypeOption,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { ATTENDANCE_LEAVE_FILTER_NONE } from "@/features/attendance/attendanceListShared";
import { employeeHasPayrollOvertimeHours, isAttendanceHalfPnLeaveType } from "@/features/attendance/attendanceDayMeta";
import { employeeRegimeWorkingHoursFlags } from "@/features/attendance/employeeRegime";
import {
  getAttendanceWorkingHoursHours,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";
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

/** @param {string} filterValue */
export function findPayrollLeaveTypeFilterOption(filterValue) {
  const s = String(filterValue ?? "").trim();
  if (!s || s === PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL) return null;
  if (s === ATTENDANCE_LEAVE_FILTER_NONE) return { value: ATTENDANCE_LEAVE_FILTER_NONE };
  return (
    ATTENDANCE_LOAI_PHEP_OPTIONS.find(
      (o) => o.value === s || o.shortLabel === s,
    ) ?? null
  );
}

/** Tuỳ chọn dropdown «Loại phép» trên lưới tháng — cùng danh mục Điểm danh. */
export function buildPayrollMonthLeaveTypeFilterOptions(tl = (k, d) => d) {
  return [
    {
      value: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
      label: tl("monthlyTimesheetFilterAll", "Tất cả"),
    },
    {
      value: ATTENDANCE_LEAVE_FILTER_NONE,
      label: tl(
        "leaveTypeFilterNone",
        "Không có loại phép (chỉ giờ / trống)",
      ),
    },
    ...ATTENDANCE_LOAI_PHEP_OPTIONS.map((opt) => ({
      value: opt.value,
      label: `${opt.shortLabel} — ${opt.value}`,
    })),
  ];
}

/**
 * @param {{
 *   hasLeaveType?: boolean,
 *   hasLeaveTypeNone?: boolean,
 *   leaveTypeValues?: Set<string>,
 *   leaveTypeRaw?: unknown,
 * }} flags
 * @param {string} leaveTypeFilter
 */
export function matchesPayrollLeaveTypeFilter(flags, leaveTypeFilter) {
  const filter = String(leaveTypeFilter ?? PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
  if (filter === PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL) return true;

  if (filter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH) {
    return Boolean(flags?.hasLeaveType);
  }
  if (filter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT) {
    return !flags?.hasLeaveType;
  }
  if (filter === ATTENDANCE_LEAVE_FILTER_NONE) {
    return Boolean(flags?.hasLeaveTypeNone);
  }

  const opt = findPayrollLeaveTypeFilterOption(filter);
  if (!opt || opt.value === ATTENDANCE_LEAVE_FILTER_NONE) return true;

  if (flags?.leaveTypeValues instanceof Set) {
    return flags.leaveTypeValues.has(opt.value);
  }

  return rawMatchesAttendanceTypeOption(flags?.leaveTypeRaw, opt);
}

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
    nightShiftFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
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
  if (!matchesPayrollLeaveTypeFilter(flags, leaveTypeFilter)) {
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
  if (
    nightShiftFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH &&
    !flags?.hasNightShift
  ) {
    return false;
  }
  if (
    nightShiftFilter === PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT &&
    flags?.hasNightShift
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
    let hasLeaveTypeNone = false;
    const leaveTypeValues = new Set();
    let hasOvertime = false;
    let hasShortHours = false;
    let hasNightShift = false;

    for (const dateKey of monthKeys) {
      const ch = chunkByDate?.get(dateKey);
      if (!ch) continue;
      const emp = resolvePayrollMonthDayEmployee(ch, id, rep);
      if (!emp) continue;

      if (!hasNightShift && isNightShiftCaLamViec(emp?.caLamViec)) {
        hasNightShift = true;
      }

      const leaveRaw = getAttendanceLeaveTypeRaw(emp);
      const leaveTrimmed = String(leaveRaw ?? "").trim();
      if (!leaveTrimmed) {
        hasLeaveTypeNone = true;
      } else {
        hasLeaveType = true;
        for (const opt of ATTENDANCE_LOAI_PHEP_OPTIONS) {
          if (rawMatchesAttendanceTypeOption(leaveRaw, opt)) {
            leaveTypeValues.add(opt.value);
          }
        }
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

      if (hasLeaveType && hasOvertime && hasShortHours && hasNightShift) break;
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
      hasLeaveTypeNone,
      leaveTypeValues,
      hasOvertime,
      hasShortHours,
      hasNightShift,
    });
  }

  return map;
}
