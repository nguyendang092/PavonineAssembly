import { memo } from "react";
import HrDebouncedSearchField from "@/components/ui/HrDebouncedSearchField";

function AnnualLeaveManagerToolbar({
  t,
  year,
  yearOptions,
  monthFilter,
  monthOptions,
  searchResetKey,
  onDebouncedSearchChange,
  deptFilter,
  departments,
  displayRowCount,
  onYearChange,
  onMonthFilterChange,
  onDeptFilterChange,
  actionsSlot,
}) {
  return (
    <div className="attendance-toolbar-controls sticky top-0 z-30 mb-1 flex shrink-0 flex-col gap-1 border-b border-slate-200/90 bg-white px-1.5 py-1 shadow-sm sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:px-2 dark:border-slate-700/90 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <label className="flex h-7 items-center gap-1">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black dark:text-blue-400">
            {t("annualLeave.year")}
          </span>
          <select
            className="h-8 min-w-[4.5rem] rounded-md border bg-white px-2 text-sm font-semibold text-black focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300"
            value={year}
            onChange={onYearChange}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-7 items-center gap-1">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black dark:text-blue-400">
            {t("annualLeave.workHoursMonthLabel", { defaultValue: "Tháng" })}
          </span>
          <select
            className="h-8 min-w-[5.5rem] rounded-md border bg-white px-2 text-sm font-semibold text-black focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300"
            value={monthFilter}
            onChange={onMonthFilterChange}
            aria-label={t("annualLeave.workHoursMonthLabel", {
              defaultValue: "Tháng",
            })}
          >
            <option value="">
              {t("annualLeave.workHoursAllMonths", { defaultValue: "Tất cả" })}
            </option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {t("annualLeave.workHoursMonthOption", {
                  defaultValue: "{{month}}/{{year}}",
                  month,
                  year,
                })}
              </option>
            ))}
          </select>
        </label>

        <HrDebouncedSearchField
          resetKey={searchResetKey}
          onDebouncedChange={onDebouncedSearchChange}
          placeholder={t("annualLeave.searchPlaceholder")}
          className="h-8 w-full min-w-0 rounded-md border px-2 text-sm text-black focus:ring-2 focus:ring-blue-200 sm:w-44 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />

        <select
          className="h-8 max-w-full rounded-md border bg-white px-2 text-xs font-medium text-black dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 sm:max-w-[11rem]"
          value={deptFilter}
          onChange={onDeptFilterChange}
        >
          <option value="">{t("annualLeave.allDepartments")}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
        <span className="inline-flex h-8 items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 text-xs font-semibold text-black dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          {t("annualLeave.rowCount", { count: displayRowCount })}
        </span>
        {actionsSlot}
      </div>
    </div>
  );
}

function areToolbarPropsEqual(prev, next) {
  return (
    prev.t === next.t &&
    prev.year === next.year &&
    prev.yearOptions === next.yearOptions &&
    prev.monthFilter === next.monthFilter &&
    prev.monthOptions === next.monthOptions &&
    prev.searchResetKey === next.searchResetKey &&
    prev.deptFilter === next.deptFilter &&
    prev.departments === next.departments &&
    prev.displayRowCount === next.displayRowCount &&
    prev.onYearChange === next.onYearChange &&
    prev.onMonthFilterChange === next.onMonthFilterChange &&
    prev.onDebouncedSearchChange === next.onDebouncedSearchChange &&
    prev.onDeptFilterChange === next.onDeptFilterChange &&
    prev.actionsSlot === next.actionsSlot
  );
}

export default memo(AnnualLeaveManagerToolbar, areToolbarPropsEqual);
