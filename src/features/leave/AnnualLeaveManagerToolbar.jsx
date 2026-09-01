import { memo } from "react";
import HrDebouncedSearchField from "@/components/ui/HrDebouncedSearchField";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

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
  deptFilterPending = false,
  onYearChange,
  onMonthFilterChange,
  onDeptFilterChange,
}) {
  const periodMonthLabel = monthFilter
    ? t("annualLeave.workHoursMonthOption", {
        defaultValue: "{{month}}/{{year}}",
        month: monthFilter,
        year,
      })
    : t("annualLeave.workHoursAllMonths", { defaultValue: "Tất cả" });

  return (
    <div className="annual-leave-filterbar" role="toolbar" aria-label={t("annualLeave.title")}>
      <div className="annual-leave-filter-group annual-leave-filter-group--period">
        <span className="annual-leave-filter-icon" aria-hidden>
          📅
        </span>
        <div className="annual-leave-filter-body">
          <span className="annual-leave-flabel">
            {t("annualLeave.filterPeriodLabel", { defaultValue: "Kỳ xem" })}
          </span>
          <div className="annual-leave-fvalue-row">
            <select
              className="annual-leave-fselect"
              value={year}
              onChange={onYearChange}
              aria-label={t("annualLeave.year")}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="annual-leave-fslash">/</span>
            <select
              className="annual-leave-fselect"
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
          </div>
          <span className="sr-only">{periodMonthLabel}</span>
        </div>
      </div>

      <div className="annual-leave-filter-group annual-leave-filter-group--dept">
        <span className="annual-leave-filter-icon" aria-hidden>
          🏢
        </span>
        <div className="annual-leave-filter-body">
          <span className="annual-leave-flabel">
            {t("annualLeave.filterDeptLabel", { defaultValue: "Bộ phận" })}
          </span>
          <select
            className="annual-leave-fselect"
            value={deptFilter}
            onChange={onDeptFilterChange}
            aria-busy={deptFilterPending || undefined}
            aria-describedby={
              deptFilterPending ? "annual-leave-dept-loading" : undefined
            }
          >
            <option value="">{t("annualLeave.allDepartments")}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {deptFilterPending ? (
            <span
              id="annual-leave-dept-loading"
              className="annual-leave-toolbar-loading inline-flex shrink-0 items-center"
              aria-live="polite"
            >
              <LoadingSpinner size="xs" className="shrink-0" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="annual-leave-filter-group annual-leave-filter-search">
        <span className="annual-leave-filter-icon" aria-hidden>
          🔍
        </span>
        <div className="annual-leave-filter-body">
          <span className="annual-leave-flabel">
            {t("annualLeave.searchLabel", { defaultValue: "Tìm kiếm" })}
          </span>
          <HrDebouncedSearchField
            resetKey={searchResetKey}
            onDebouncedChange={onDebouncedSearchChange}
            placeholder={t("annualLeave.searchPlaceholder")}
            className="annual-leave-search-input"
          />
        </div>
      </div>

      <div className="annual-leave-filter-count" aria-live="polite">
        {t("annualLeave.rowCount", { count: displayRowCount })}
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
    prev.deptFilterPending === next.deptFilterPending &&
    prev.onYearChange === next.onYearChange &&
    prev.onMonthFilterChange === next.onMonthFilterChange &&
    prev.onDebouncedSearchChange === next.onDebouncedSearchChange &&
    prev.onDeptFilterChange === next.onDeptFilterChange
  );
}

export default memo(AnnualLeaveManagerToolbar, areToolbarPropsEqual);
