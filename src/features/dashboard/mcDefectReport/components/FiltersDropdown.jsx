import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiFilter } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { MC_DEFECT_FILTER_ALL } from "../lib/constants";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900";

function countActiveFilters({
  reportMonth,
  reportDepartment,
  reportEmployee,
  reportErrorType,
}) {
  let count = 0;
  if (reportMonth === MC_DEFECT_FILTER_ALL) count += 1;
  if (reportDepartment !== MC_DEFECT_FILTER_ALL) count += 1;
  if (reportEmployee !== MC_DEFECT_FILTER_ALL) count += 1;
  if (reportErrorType !== MC_DEFECT_FILTER_ALL) count += 1;
  return count;
}

function MCDefectReportFiltersDropdown({
  reportMonth,
  setReportMonth,
  reportDepartment,
  setReportDepartment,
  reportEmployee,
  setReportEmployee,
  reportErrorType,
  setReportErrorType,
  monthOptions,
  departmentOptions,
  employeeOptions,
  errorTypeOptions,
  onResetFilters,
}) {
  const { t } = useTranslation();
  const tl = (key, defaultValue, opts) =>
    t(`mcDefectReport.${key}`, { defaultValue, ...opts });

  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const placement = useAttendanceFilterDropdownPlacement(open, anchorRef);

  const close = useCallback(() => setOpen(false), []);
  useCloseDropdownOnScroll(open, panelRef, close);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    const onClickOutside = (event) => {
      if (event.button != null && event.button !== 0) return;
      const raw = event.target;
      const target =
        raw instanceof Element
          ? raw
          : raw instanceof Node && raw.parentElement
            ? raw.parentElement
            : null;
      if (!target) return;
      if (
        anchorRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("click", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const activeCount = useMemo(
    () =>
      countActiveFilters({
        reportMonth,
        reportDepartment,
        reportEmployee,
        reportErrorType,
      }),
    [reportMonth, reportDepartment, reportEmployee, reportErrorType],
  );

  const summaryHint = useMemo(() => {
    const allLabel = t("mcDefectReport.all", { defaultValue: "Tất cả" });
    const parts = [];
    parts.push(
      reportMonth === MC_DEFECT_FILTER_ALL ? allLabel : reportMonth,
    );
    if (reportDepartment !== MC_DEFECT_FILTER_ALL) {
      parts.push(reportDepartment);
    }
    if (reportEmployee !== MC_DEFECT_FILTER_ALL) {
      parts.push(reportEmployee);
    }
    if (reportErrorType !== MC_DEFECT_FILTER_ALL) {
      parts.push(reportErrorType);
    }
    return parts.join(" · ");
  }, [
    t,
    reportMonth,
    reportDepartment,
    reportEmployee,
    reportErrorType,
  ]);

  return (
    <div className="mc-defect-filter-dropdown relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="flex h-full min-h-[3.25rem] w-full flex-col justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-left transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-sky-700 dark:hover:bg-slate-800/90 sm:min-w-[11rem]"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FiFilter size={11} aria-hidden />
          {tl("filtersTitle", "Bộ lọc")}
          {activeCount > 0 ? (
            <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-extrabold leading-none text-white">
              {activeCount}
            </span>
          ) : null}
          <span className="ml-auto text-[9px] opacity-70" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
        <span className="mt-0.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
          {summaryHint}
        </span>
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={tl("filtersTitle", "Bộ lọc")}
              className="mc-defect-filter-dropdown__panel fixed flex flex-col overflow-hidden overscroll-contain rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                top: placement.top,
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
                zIndex: "var(--z-navbar-dropdown, 110)",
              }}
            >
              <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                {tl("filtersTitle", "Bộ lọc")}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tl("month", "Tháng")}
                    </span>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className={selectClass}
                    >
                      <option value={MC_DEFECT_FILTER_ALL}>
                        {tl("all", "Tất cả")}
                      </option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tl("department", "Bộ phận")}
                    </span>
                    <select
                      value={reportDepartment}
                      onChange={(e) => setReportDepartment(e.target.value)}
                      className={selectClass}
                    >
                      <option value={MC_DEFECT_FILTER_ALL}>
                        {tl("all", "Tất cả")}
                      </option>
                      {departmentOptions.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tl("employee", "Nhân viên")}
                    </span>
                    <select
                      value={reportEmployee}
                      onChange={(e) => setReportEmployee(e.target.value)}
                      className={selectClass}
                    >
                      <option value={MC_DEFECT_FILTER_ALL}>
                        {tl("all", "Tất cả")}
                      </option>
                      {employeeOptions.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tl("errorType", "Loại lỗi")}
                    </span>
                    <select
                      value={reportErrorType}
                      onChange={(e) => setReportErrorType(e.target.value)}
                      className={selectClass}
                    >
                      <option value={MC_DEFECT_FILTER_ALL}>
                        {tl("all", "Tất cả")}
                      </option>
                      {errorTypeOptions.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    onResetFilters();
                    close();
                  }}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  {tl("resetFilters", "Đặt lại bộ lọc")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(MCDefectReportFiltersDropdown);
