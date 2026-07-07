import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";

function ToolsMenuSection({ label, first = false }) {
  return (
    <div
      className={`shrink-0 bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 ${
        first
          ? "border-b border-gray-100 dark:border-slate-700"
          : "border-t border-b border-gray-100 dark:border-slate-700"
      }`}
    >
      {label}
    </div>
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
  onExportOneDay,
  onExportRange,
  showEarlyOtAction,
  showLateOtAction,
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const placement = useAttendanceFilterDropdownPlacement(open, anchorRef);

  const close = useCallback(() => setOpen(false), []);

  useCloseDropdownOnScroll(open, panelRef, close);

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
                width: placement.width,
                maxHeight: placement.maxHeight,
                minHeight: Math.min(placement.maxHeight, 420),
              }}
            >
              <div className="shrink-0 border-b border-[#1557b0] bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white">
                {t("attendanceList.toolsMenu", { defaultValue: "Công cụ" })}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                <ToolsMenuSection
                  first
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

                {showEarlyOtAction || showLateOtAction ? (
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
