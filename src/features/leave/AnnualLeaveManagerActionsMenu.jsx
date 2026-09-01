import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
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
        className="annual-leave-actions-btn"
        onClick={() => setActionsOpen((open) => !open)}
        aria-expanded={actionsOpen}
        aria-haspopup="menu"
        aria-busy={syncing}
        disabled={syncing}
      >
        {syncing ? (
          <LoadingSpinner size="xs" className="text-white" aria-label="" />
        ) : (
          <span aria-hidden>⚙️</span>
        )}
        {syncing
          ? t("annualLeave.recalculating", { defaultValue: "Đang tính lại…" })
          : t("annualLeave.actionsMenu", { defaultValue: "Chức năng" })}
        <span className="text-[10px] opacity-90" aria-hidden>
          {actionsOpen ? "▲" : "▼"}
        </span>
      </button>

      {actionsOpen && actionsPlacement
        ? createPortal(
            <div
              ref={actionsPanelRef}
              role="menu"
              className="annual-leave-actions-dropdown attendance-tools-dropdown attendance-toolbar-controls fixed flex flex-col overflow-hidden overscroll-contain"
              style={{
                zIndex: "var(--z-modal-content, 1210)",
                top: actionsPlacement.top,
                left: actionsPlacement.left,
                width: actionsPlacement.width,
                maxHeight: actionsPlacement.maxHeight,
                minHeight: Math.min(actionsPlacement.maxHeight, 420),
              }}
            >
              <div className="annual-leave-actions-dropdown-header shrink-0">
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
                    className="annual-leave-actions-dropdown-item"
                    onClick={() => {
                      setActionsOpen(false);
                      onRecalculate();
                    }}
                  >
                    {syncing ? (
                      <LoadingSpinner size="xs" aria-label="" />
                    ) : (
                      <span className="shrink-0 text-lg" aria-hidden>
                        🔄
                      </span>
                    )}
                    <span className="text-sm font-semibold">
                      {syncing
                        ? t("annualLeave.recalculating", {
                            defaultValue: "Đang tính lại…",
                          })
                        : t("annualLeave.recalculate", {
                            defaultValue: "Tính toán lại",
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
                      className="annual-leave-actions-dropdown-item"
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
                      className="annual-leave-actions-dropdown-item annual-leave-actions-dropdown-item--danger"
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
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(AnnualLeaveManagerActionsMenu);
