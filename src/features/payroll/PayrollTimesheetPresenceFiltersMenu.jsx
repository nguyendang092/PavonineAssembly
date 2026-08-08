import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";
import { PayrollTimesheetPresenceFilterFields } from "@/features/payroll/PayrollTimesheetPresenceFilters";
import {
  countActivePayrollTimesheetPresenceFilters,
  PAYROLL_SHORT_HOURS_FILTER,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";

function PayrollTimesheetPresenceFiltersMenu({
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
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const placement = useAttendanceFilterDropdownPlacement(open, anchorRef);
  const closeMenu = () => setOpen(false);
  useCloseDropdownOnScroll(open, panelRef, closeMenu);

  const activeCount = countActivePayrollTimesheetPresenceFilters({
    workHoursFilter,
    leaveTypeFilter,
    overtimeFilter,
    shortHoursFilter,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
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
      closeMenu();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const handleClear = () => {
    onWorkHoursFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onLeaveTypeFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onOvertimeFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onShortHoursFilterChange?.(PAYROLL_SHORT_HOURS_FILTER.ALL);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-bold shadow-sm transition disabled:opacity-50 ${
          activeCount > 0
            ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-900/50"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={tl(
          "monthlyTimesheetFiltersMenuHint",
          "Giờ công, loại phép, tăng ca, giờ công dưới 8h",
        )}
      >
        <span aria-hidden>⏷</span>
        {tl("monthlyTimesheetFiltersMenu", "Bộ lọc")}
        {activeCount > 0 ? (
          <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-extrabold leading-none text-white dark:bg-indigo-500">
            {activeCount}
          </span>
        ) : null}
        <span className="text-[10px] opacity-80" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={tl(
                "monthlyTimesheetFiltersMenuTitle",
                "Bộ lọc lưới tháng",
              )}
              className="attendance-tools-dropdown attendance-toolbar-controls pm-ts-filters-menu-panel fixed flex flex-col overflow-hidden overscroll-contain rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                zIndex: "calc(var(--z-modal-backdrop, 1200) + 25)",
                top: placement.top,
                left: placement.left,
                width: Math.max(placement.width, 280),
                maxHeight: placement.maxHeight,
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-white">
                  {tl("monthlyTimesheetFiltersMenuTitle", "Bộ lọc lưới tháng")}
                </span>
                {activeCount > 0 ? (
                  <button
                    type="button"
                    className="rounded-md border border-white/40 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-white/25"
                    onClick={handleClear}
                  >
                    {tl("monthlyTimesheetFiltersClear", "Xóa bộ lọc")}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto p-3">
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
                  layout="stack"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(PayrollTimesheetPresenceFiltersMenu);
