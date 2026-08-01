import {
  getAttendanceDayEmployeePresenceFlags,
  matchesPayrollMonthTimesheetPresenceFilter,
} from "@/features/payroll/attendanceDayPresenceFilters";
import { filterPayrollEmployeesByDepartments } from "@/features/payroll/payrollExportDepartmentFilter";
import { resolveEffectivePayrollEarlyOtPaperwork } from "@/features/payroll/payrollEarlyOtMeta";
import { resolveEffectivePayrollNightOtPaperwork } from "@/features/payroll/payrollNightOtMeta";
import { PAYROLL_EMP } from "@/features/payroll/payrollEmployeeFields";
import {
  needsPayrollMonthTimesheetPresenceFlags,
  PAYROLL_SHORT_HOURS_FILTER,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";

export const PAYROLL_TIMESHEET_EXPORT_FILTER_DEFAULTS = Object.freeze({
  searchTerm: "",
  departmentFilter: "",
  workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  overtimeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.ALL,
});

function payrollEmployeeForDayPresenceFlags(
  emp,
  { earlyOtPaperworkById = {}, lateOtExcludedById = {}, nightOtPaperworkById = {} } = {},
) {
  return {
    ...emp,
    [PAYROLL_EMP.PAYROLL_EARLY_OT_PAPERWORK]:
      resolveEffectivePayrollEarlyOtPaperwork(
        emp,
        earlyOtPaperworkById?.[emp?.id],
      ),
    [PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED]:
      emp[PAYROLL_EMP.PAYROLL_LATE_OT_EXCLUDED] ??
      lateOtExcludedById?.[emp?.id],
    [PAYROLL_EMP.PAYROLL_NIGHT_OT_PAPERWORK]:
      resolveEffectivePayrollNightOtPaperwork(
        emp,
        nightOtPaperworkById?.[emp?.id],
      ),
  };
}

/** Có bộ lọc toolbar đang bật (ngoài bộ phận trong modal xuất). */
export function hasActivePayrollTimesheetToolbarExportFilters(
  toolbarFilters = {},
) {
  return (
    String(toolbarFilters.searchTerm ?? "").trim().length > 0 ||
    String(toolbarFilters.departmentFilter ?? "").trim().length > 0 ||
    needsPayrollMonthTimesheetPresenceFlags(toolbarFilters)
  );
}

/**
 * Lọc NV trước khi xuất Excel — đồng bộ toolbar Xem giờ công (tìm kiếm, BP, giờ công, phép, TC, <8h).
 */
export function filterPayrollEmployeesForTimesheetExport(
  employees,
  {
    searchTerm = "",
    departmentFilter = "",
    exportDepartments = [],
    workHoursFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    leaveTypeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    overtimeFilter = PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
    shortHoursFilter = PAYROLL_SHORT_HOURS_FILTER.ALL,
    normalizeDepartment = (v) => String(v ?? "").trim().toLowerCase(),
    dayCtx = {},
    earlyOtPaperworkById = {},
    lateOtExcludedById = {},
    nightOtPaperworkById = {},
  } = {},
) {
  const q = String(searchTerm ?? "").trim().toLowerCase();
  const departmentFilterKey = normalizeDepartment(departmentFilter);

  let list = filterPayrollEmployeesByDepartments(
    Array.isArray(employees) ? employees : [],
    exportDepartments,
    normalizeDepartment,
  );

  return list.filter((emp) => {
    const empDeptKey = normalizeDepartment(emp?.boPhan);
    if (departmentFilterKey && empDeptKey !== departmentFilterKey) return false;

    const empForFlags = payrollEmployeeForDayPresenceFlags(emp, {
      earlyOtPaperworkById,
      lateOtExcludedById,
      nightOtPaperworkById,
    });

    if (
      !matchesPayrollMonthTimesheetPresenceFilter(
        getAttendanceDayEmployeePresenceFlags(empForFlags, dayCtx),
        {
          workHoursFilter,
          leaveTypeFilter,
          overtimeFilter,
          shortHoursFilter,
        },
      )
    ) {
      return false;
    }

    if (!q) return true;
    return (
      (emp.hoVaTen || "").toLowerCase().includes(q) ||
      (emp.mnv || "").toLowerCase().includes(q) ||
      (emp.boPhan || "").toLowerCase().includes(q)
    );
  });
}
