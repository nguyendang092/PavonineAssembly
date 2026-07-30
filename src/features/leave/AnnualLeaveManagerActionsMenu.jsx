import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAttendanceFilterDropdownPlacement } from "@/features/attendance/useAttendanceToolbarDropdownPlacement";
import { useCloseDropdownOnScroll } from "@/features/attendance/useCloseDropdownOnScroll";

function AnnualLeaveManagerActionsMenu({
  t,
  canManage,
  actionsOpen,
  setActionsOpen,
  actionsAnchorRef,
  actionsPanelRef,
  fileInputRef,
  syncing,
  uploading,
  deleting,
  hasEntries,
  onRecalculate,
  onUpload,
  onDelete,
  onExport,
}) {
  const closeActionsMenu = () => setActionsOpen(false);
  const actionsPlacement = useAttendanceFilterDropdownPlacement(
    actionsOpen,
    actionsAnchorRef,
  );
  useCloseDropdownOnScroll(actionsOpen, actionsPanelRef, closeActionsMenu);

  useEffect(() => {
    if (!actionsOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeActionsMenu();
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
        actionsAnchorRef.current?.contains(target) ||
        actionsPanelRef.current?.contains(target)
      ) {
        return;
      }
      closeActionsMenu();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClickOutside);
    };
  }, [actionsOpen, actionsAnchorRef, actionsPanelRef]);

  return (
    <div className="relative shrink-0">
      <button
        ref={actionsAnchorRef}
        type="button"
        className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[#1a73e8] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1557b0] sm:text-sm"
        onClick={() => setActionsOpen((open) => !open)}
        aria-expanded={actionsOpen}
        aria-haspopup="menu"
      >
        <span aria-hidden>⚙️</span>
        {t("annualLeave.actionsMenu", { defaultValue: "Chức năng" })}
        <span className="text-[10px] opacity-90" aria-hidden>
          {actionsOpen ? "▲" : "▼"}
        </span>
      </button>

      {actionsOpen && actionsPlacement
        ? createPortal(
            <div
              ref={actionsPanelRef}
              role="menu"
              className="attendance-tools-dropdown attendance-toolbar-controls fixed flex flex-col overflow-hidden overscroll-contain rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                zIndex: "var(--z-navbar-dropdown, 110)",
                top: actionsPlacement.top,
                left: actionsPlacement.left,
                width: actionsPlacement.width,
                maxHeight: actionsPlacement.maxHeight,
                minHeight: Math.min(actionsPlacement.maxHeight, 420),
              }}
            >
              <div className="shrink-0 border-b border-[#1557b0] bg-[#1a73e8] px-4 py-2 text-sm font-bold text-white">
                {t("annualLeave.actionsMenu", {
                  defaultValue: "Chức năng",
                })}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                {canManage ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={syncing}
                    className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => {
                      setActionsOpen(false);
                      onRecalculate();
                    }}
                  >
                    <span className="shrink-0 text-lg" aria-hidden>
                      🔄
                    </span>
                    <span className="text-sm font-semibold">
                      {syncing
                        ? t("annualLeave.recalculating", {
                            defaultValue: "Đang tính lại…",
                          })
                        : t("annualLeave.recalculate", {
                            defaultValue: "Tính lại từ điểm danh",
                          })}
                    </span>
                  </button>
                ) : null}

                {canManage ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        setActionsOpen(false);
                        onUpload(e);
                      }}
                    />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={uploading}
                      className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="shrink-0 text-lg" aria-hidden>
                        📤
                      </span>
                      <span className="text-sm font-semibold">
                        {uploading
                          ? t("annualLeave.uploading")
                          : t("annualLeave.uploadExcel")}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={deleting || !hasEntries}
                      className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-300 dark:hover:bg-red-950/40"
                      onClick={() => {
                        setActionsOpen(false);
                        onDelete();
                      }}
                    >
                      <span className="shrink-0 text-lg" aria-hidden>
                        🗑️
                      </span>
                      <span className="text-sm font-semibold">
                        {deleting
                          ? t("annualLeave.deletingYearData", {
                              defaultValue: "Đang xóa…",
                            })
                          : t("annualLeave.deleteYearData", {
                              defaultValue: "Xóa dữ liệu phép năm",
                            })}
                      </span>
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-gray-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setActionsOpen(false);
                    onExport();
                  }}
                  disabled={!hasEntries}
                >
                  <span className="shrink-0 text-lg" aria-hidden>
                    📥
                  </span>
                  <span className="text-sm font-semibold">
                    {t("annualLeave.exportExcel")}
                  </span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(AnnualLeaveManagerActionsMenu);
