import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";
import { PayrollTimesheetPresenceFilterFields } from "@/features/payroll/PayrollTimesheetPresenceFilters";
import {
  countActivePayrollTimesheetPresenceFilters,
  PAYROLL_SHORT_HOURS_FILTER,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";

function ToolsMenuSection({ label, first = false, action = null }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-2 bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 ${
        first
          ? "border-b border-gray-100 dark:border-slate-700"
          : "border-t border-b border-gray-100 dark:border-slate-700"
      }`}
    >
      <span>{label}</span>
      {action}
    </div>
  );
}

function ToolsMenuCollapsibleSection({
  label,
  open,
  onToggle,
  first = false,
  badge = null,
  action = null,
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`flex w-full shrink-0 items-center justify-between gap-2 bg-slate-50 px-4 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 transition hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800 ${
        first
          ? "border-b border-gray-100 dark:border-slate-700"
          : "border-t border-b border-gray-100 dark:border-slate-700"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span>{label}</span>
        {badge}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {action}
        <span className="text-[10px] opacity-80" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </span>
    </button>
  );
}

function ToolsMenuItem({ icon, title, hint, onClick, disabled = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full shrink-0 items-center gap-3 border-b px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="shrink-0 text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {hint ? (
          <div className="text-xs text-gray-500 dark:text-slate-400">{hint}</div>
        ) : null}
      </div>
    </button>
  );
}

function PayrollToolsMenu({
  tlPage,
  t,
  onOpenMonthlyTimesheet,
  onOpenMonthlyTimeInOut,
  onOpenEarlyOt,
  onOpenLateOt,
  onOpenNightOt,
  onExportOneDay,
  onExportRange,
  showEarlyOtAction,
  showLateOtAction,
  showNightOtAction = false,
  showMonthlyTimeInOut = true,
  showPresenceFilters = false,
  workHoursFilter,
  leaveTypeFilter,
  overtimeFilter,
  shortHoursFilter,
  onWorkHoursFilterChange,
  onLeaveTypeFilterChange,
  onOvertimeFilterChange,
  onShortHoursFilterChange,
  filtersDisabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [presenceFiltersOpen, setPresenceFiltersOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const placement = useAttendanceFilterDropdownPlacement(open, anchorRef);

  const close = useCallback(() => setOpen(false), []);

  const activeFilterCount = showPresenceFilters
    ? countActivePayrollTimesheetPresenceFilters({
        workHoursFilter,
        leaveTypeFilter,
        overtimeFilter,
        shortHoursFilter,
      })
    : 0;

  const handleClearFilters = useCallback(() => {
    onWorkHoursFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onLeaveTypeFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onOvertimeFilterChange?.(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    onShortHoursFilterChange?.(PAYROLL_SHORT_HOURS_FILTER.ALL);
  }, [
    onWorkHoursFilterChange,
    onLeaveTypeFilterChange,
    onOvertimeFilterChange,
    onShortHoursFilterChange,
  ]);

  useCloseDropdownOnScroll(open, panelRef, close);

  useEffect(() => {
    if (!open) setPresenceFiltersOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
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

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-full max-w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[#1a73e8] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1557b0] sm:w-auto sm:text-sm"
      >
        <span aria-hidden>🛠</span>
        {t("attendanceList.toolsMenu", { defaultValue: "Công cụ" })}
        {activeFilterCount > 0 ? (
          <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-extrabold leading-none text-white">
            {activeFilterCount}
          </span>
        ) : null}
        <span className="text-[10px] opacity-90" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className="attendance-tools-dropdown attendance-toolbar-controls fixed flex flex-col overflow-hidden overscroll-contain rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                zIndex: "var(--z-navbar-dropdown, 110)",
                top: placement.top,
                left: placement.left,
                width: Math.max(placement.width, 280),
                maxHeight: placement.maxHeight,
              }}
            >
              <div className="shrink-0 border-b border-[#1557b0] bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white">
                {t("attendanceList.toolsMenu", { defaultValue: "Công cụ" })}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                {showPresenceFilters ? (
                  <>
                    <ToolsMenuCollapsibleSection
                      first
                      open={presenceFiltersOpen}
                      onToggle={() => setPresenceFiltersOpen((value) => !value)}
                      label={tlPage("monthlyTimesheetFiltersMenu", "Bộ lọc")}
                      badge={
                        activeFilterCount > 0 ? (
                          <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[#1a73e8] px-1 text-[9px] font-extrabold leading-none text-white dark:bg-blue-500">
                            {activeFilterCount}
                          </span>
                        ) : null
                      }
                      action={
                        activeFilterCount > 0 ? (
                          <button
                            type="button"
                            className="normal-case tracking-normal text-[11px] font-bold text-[#1a73e8] hover:underline dark:text-blue-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleClearFilters();
                            }}
                          >
                            {tlPage("monthlyTimesheetFiltersClear", "Xóa")}
                          </button>
                        ) : null
                      }
                    />
                    {presenceFiltersOpen ? (
                      <PayrollTimesheetPresenceFilterFields
                        workHoursFilter={workHoursFilter}
                        leaveTypeFilter={leaveTypeFilter}
                        overtimeFilter={overtimeFilter}
                        shortHoursFilter={shortHoursFilter}
                        onWorkHoursFilterChange={onWorkHoursFilterChange}
                        onLeaveTypeFilterChange={onLeaveTypeFilterChange}
                        onOvertimeFilterChange={onOvertimeFilterChange}
                        onShortHoursFilterChange={onShortHoursFilterChange}
                        tl={tlPage}
                        disabled={filtersDisabled}
                        layout="toolsMenu"
                      />
                    ) : null}
                  </>
                ) : null}
                <ToolsMenuSection
                  first={!showPresenceFilters}
                  label={tlPage("toolsSectionView", "Xem giờ công")}
                />
                <ToolsMenuItem
                  icon="▦"
                  title={tlPage("monthlyTimesheetButton", "Bảng chấm công")}
                  hint={tlPage(
                    "monthlyGridMenuTimesheetDesc",
                    "Giờ công, phép, hệ số tăng ca",
                  )}
                  onClick={() => {
                    close();
                    onOpenMonthlyTimesheet();
                  }}
                />
                {showMonthlyTimeInOut ? (
                  <ToolsMenuItem
                    icon="⏱"
                    title={tlPage("monthlyTimeInOutButton", "Giờ vào / ra tháng")}
                    hint={tlPage(
                      "monthlyGridMenuTimeInOutDesc",
                      "Giờ vào & giờ ra mỗi ngày",
                    )}
                    onClick={() => {
                      close();
                      onOpenMonthlyTimeInOut();
                    }}
                  />
                ) : null}

                {showEarlyOtAction || showLateOtAction || showNightOtAction ? (
                  <ToolsMenuSection
                    label={t("attendanceList.toolsSectionActions", {
                      defaultValue: "Chức năng",
                    })}
                  />
                ) : null}
                {showEarlyOtAction ? (
                  <ToolsMenuItem
                    icon="✅"
                    title={tlPage("earlyOtPaperworkButton", "Xác nhận tăng ca")}
                    hint={tlPage(
                      "earlyOtPaperworkHint",
                      "TC sớm (giấy): trước 06:00 → 2h (05:40–06:40 + 06:40–07:40); từ 06:00 → 06:40–07:40 (1h).",
                    )}
                    onClick={() => {
                      close();
                      onOpenEarlyOt();
                    }}
                  />
                ) : null}
                {showLateOtAction ? (
                  <ToolsMenuItem
                    icon="🚫"
                    title={tlPage("lateOtPaperworkButton", "Không TC >17:30")}
                    hint={tlPage(
                      "lateOtPaperworkHint",
                      "Đánh dấu những nhân viên ra sau 17:30 nhưng KHÔNG tính tăng ca.",
                    )}
                    onClick={() => {
                      close();
                      onOpenLateOt();
                    }}
                  />
                ) : null}
                {showNightOtAction ? (
                  <ToolsMenuItem
                    icon="🌙"
                    title={tlPage(
                      "nightOtPaperworkButton",
                      "Xác nhận tăng ca đêm",
                    )}
                    hint={tlPage(
                      "nightOtPaperworkHint",
                      "Giờ vào 22:00–05:00 → hệ số tăng ca ×2.7 (ngày thường).",
                    )}
                    onClick={() => {
                      close();
                      onOpenNightOt?.();
                    }}
                  />
                ) : null}

                <ToolsMenuSection
                  label={tlPage("toolsSectionExport", "Xuất Excel")}
                />
                <ToolsMenuItem
                  icon="⬇"
                  title={tlPage("exportExcelOneDay", "Một ngày (ngày đang chọn)")}
                  hint={tlPage(
                    "exportExcelHint",
                    "Xuất toàn bộ nhân viên trong ngày (theo dữ liệu điểm danh), đủ các cột giờ như trên bảng.",
                  )}
                  onClick={() => {
                    close();
                    onExportOneDay();
                  }}
                />
                <ToolsMenuItem
                  icon="⬇"
                  title={tlPage("exportExcelRange", "Nhiều ngày")}
                  hint={tlPage(
                    "exportExcelRangeHint",
                    "Xuất Excel nhiều ngày: chọn từ ngày và đến ngày (mặc định hôm nay).",
                  )}
                  onClick={() => {
                    close();
                    onExportRange();
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(PayrollToolsMenu);
