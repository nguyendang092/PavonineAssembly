import React, { memo } from "react";
import {
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";

const selectClass =
  "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

const toolsMenuSelectClass =
  "h-7 w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-800 focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function PayrollTimesheetPresenceFilterFields({
  workHoursFilter,
  leaveTypeFilter,
  overtimeFilter,
  shortHoursFilter,
  onWorkHoursFilterChange,
  onLeaveTypeFilterChange,
  onOvertimeFilterChange,
  onShortHoursFilterChange,
  tl,
  disabled = false,
  layout = "inline",
}) {
  if (layout === "toolsMenu") {
    const rows = [
      {
        key: "workHours",
        label: tl("monthlyTimesheetFilterWorkHours", "Giờ công"),
        value: workHoursFilter,
        onChange: onWorkHoursFilterChange,
        options: [
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
            label: tl("monthlyTimesheetFilterAll", "Tất cả"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
            label: tl("monthlyTimesheetFilterWith", "Có"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
            label: tl("monthlyTimesheetFilterWithout", "Không"),
          },
        ],
      },
      {
        key: "leaveType",
        label: tl("monthlyTimesheetFilterLeaveType", "Loại phép"),
        value: leaveTypeFilter,
        onChange: onLeaveTypeFilterChange,
        options: [
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
            label: tl("monthlyTimesheetFilterAll", "Tất cả"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
            label: tl("monthlyTimesheetFilterWith", "Có"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
            label: tl("monthlyTimesheetFilterWithout", "Không"),
          },
        ],
      },
      {
        key: "overtime",
        label: tl("monthlyTimesheetFilterOvertime", "Tăng ca"),
        value: overtimeFilter,
        onChange: onOvertimeFilterChange,
        options: [
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
            label: tl("monthlyTimesheetFilterAll", "Tất cả"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
            label: tl("monthlyTimesheetFilterWith", "Có"),
          },
          {
            value: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
            label: tl("monthlyTimesheetFilterWithout", "Không"),
          },
        ],
      },
      {
        key: "shortHours",
        label: tl("monthlyTimesheetFilterShortHours", "Giờ công < 8"),
        value: shortHoursFilter,
        onChange: onShortHoursFilterChange,
        title: tl(
          "monthlyTimesheetFilterShortHoursHint",
          "Đi trễ / về sớm — giờ công trong ngày dưới 8 giờ",
        ),
        options: [
          {
            value: PAYROLL_SHORT_HOURS_FILTER.ALL,
            label: tl("monthlyTimesheetFilterAll", "Tất cả"),
          },
          {
            value: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD,
            label: tl(
              "monthlyTimesheetFilterShortHoursUnder",
              "Đi trễ / về sớm",
            ),
          },
        ],
      },
    ];

    return (
      <>
        {rows.map((row) => (
          <label
            key={row.key}
            className="flex w-full shrink-0 flex-col gap-1.5 border-b border-gray-100 px-4 py-2.5 text-left dark:border-slate-700"
            title={row.title}
          >
            <span className="text-xs font-semibold leading-snug text-gray-700 dark:text-slate-200">
              {row.label}
            </span>
            <select
              value={row.value}
              onChange={(e) => row.onChange?.(e.target.value)}
              disabled={disabled}
              title={row.title}
              className={toolsMenuSelectClass}
            >
              {row.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </>
    );
  }

  const labelClass =
    layout === "stack"
      ? "flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
      : "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300";
  const selectLayoutClass = layout === "stack" ? "w-full min-w-0" : "";

  return (
    <>
      <label className={labelClass}>
        <span>{tl("monthlyTimesheetFilterWorkHours", "Giờ công")}</span>
        <select
          value={workHoursFilter}
          onChange={(e) => onWorkHoursFilterChange?.(e.target.value)}
          disabled={disabled}
          className={`${selectClass} ${selectLayoutClass}`}
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
          className={`${selectClass} ${selectLayoutClass}`}
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
          className={`${selectClass} ${selectLayoutClass}`}
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
        <span>
          {tl("monthlyTimesheetFilterShortHours", "Giờ công < 8")}
        </span>
        <select
          value={shortHoursFilter}
          onChange={(e) => onShortHoursFilterChange?.(e.target.value)}
          disabled={disabled}
          className={`${selectClass} ${selectLayoutClass}`}
          title={tl(
            "monthlyTimesheetFilterShortHoursHint",
            "Đi trễ / về sớm — giờ công trong ngày dưới 8 giờ",
          )}
        >
          <option value={PAYROLL_SHORT_HOURS_FILTER.ALL}>
            {tl("monthlyTimesheetFilterAll", "Tất cả")}
          </option>
          <option value={PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD}>
            {tl(
              "monthlyTimesheetFilterShortHoursUnder",
              "Đi trễ / về sớm",
            )}
          </option>
        </select>
      </label>
    </>
  );
}

function PayrollTimesheetPresenceFilters({
  workHoursFilter,
  leaveTypeFilter,
  overtimeFilter,
  shortHoursFilter,
  onWorkHoursFilterChange,
  onLeaveTypeFilterChange,
  onOvertimeFilterChange,
  onShortHoursFilterChange,
  tl,
  disabled = false,
  layout = "inline",
}) {
  return (
    <PayrollTimesheetPresenceFilterFields
      workHoursFilter={workHoursFilter}
      leaveTypeFilter={leaveTypeFilter}
      overtimeFilter={overtimeFilter}
      shortHoursFilter={shortHoursFilter}
      onWorkHoursFilterChange={onWorkHoursFilterChange}
      onLeaveTypeFilterChange={onLeaveTypeFilterChange}
      onOvertimeFilterChange={onOvertimeFilterChange}
      onShortHoursFilterChange={onShortHoursFilterChange}
      tl={tl}
      disabled={disabled}
      layout={layout}
    />
  );
}

export { PayrollTimesheetPresenceFilterFields };
export default memo(PayrollTimesheetPresenceFilters);
