import React, { memo } from "react";
import { PAYROLL_TIMESHEET_PRESENCE_FILTER } from "@/features/payroll/payrollMonthTimesheetFilters";

const selectClass =
  "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function PayrollTimesheetPresenceFilters({
  workHoursFilter,
  leaveTypeFilter,
  overtimeFilter,
  onWorkHoursFilterChange,
  onLeaveTypeFilterChange,
  onOvertimeFilterChange,
  tl,
  disabled = false,
  compact = false,
}) {
  const labelClass = compact
    ? "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
    : "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300";

  return (
    <>
      <label className={labelClass}>
        <span>{tl("monthlyTimesheetFilterWorkHours", "Giờ công")}</span>
        <select
          value={workHoursFilter}
          onChange={(e) => onWorkHoursFilterChange?.(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL}>
            {tl("monthlyTimesheetFilterAll", "Tất cả")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH}>
            {tl("monthlyTimesheetFilterWith", "Có")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT}>
            {tl("monthlyTimesheetFilterWithout", "Không")}
          </option>
        </select>
      </label>
      <label className={labelClass}>
        <span>{tl("monthlyTimesheetFilterLeaveType", "Loại phép")}</span>
        <select
          value={leaveTypeFilter}
          onChange={(e) => onLeaveTypeFilterChange?.(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL}>
            {tl("monthlyTimesheetFilterAll", "Tất cả")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH}>
            {tl("monthlyTimesheetFilterWith", "Có")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT}>
            {tl("monthlyTimesheetFilterWithout", "Không")}
          </option>
        </select>
      </label>
      <label className={labelClass}>
        <span>{tl("monthlyTimesheetFilterOvertime", "Tăng ca")}</span>
        <select
          value={overtimeFilter}
          onChange={(e) => onOvertimeFilterChange?.(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL}>
            {tl("monthlyTimesheetFilterAll", "Tất cả")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH}>
            {tl("monthlyTimesheetFilterWith", "Có")}
          </option>
          <option value={PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT}>
            {tl("monthlyTimesheetFilterWithout", "Không")}
          </option>
        </select>
      </label>
    </>
  );
}

export default memo(PayrollTimesheetPresenceFilters);
