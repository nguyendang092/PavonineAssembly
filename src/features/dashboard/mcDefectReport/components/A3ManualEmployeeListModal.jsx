import React, { memo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  removeA3ManualEmployeeEntry,
  sumA3ErrorCounts,
  updateA3ManualEmployeeErrorCount,
} from "../lib/a3AnnouncementUtils";
import { normalizeA3ManualEmployeeEntry } from "../lib/a3ManualEmployeesFirebase";

const ICON_CLOSE = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
);
const ICON_USERS = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  />
);
const ICON_TRASH = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
  />
);

function A3ModalIcon({ children, className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function A3ManualEmployeeListModal({
  isOpen,
  manualEmployees,
  setManualEmployees,
  saving,
  onClose,
}) {
  const { t } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, opts) =>
      t(`mcDefectReport.${key}`, { defaultValue, ...opts }),
    [t],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleErrorCountChange = useCallback(
    (employeeName, nextValue) => {
      if (!setManualEmployees) return;
      setManualEmployees((prev) =>
        updateA3ManualEmployeeErrorCount(prev, employeeName, nextValue),
      );
    },
    [setManualEmployees],
  );

  const handleRemove = useCallback(
    (employeeName) => {
      if (!setManualEmployees) return;
      setManualEmployees((prev) =>
        removeA3ManualEmployeeEntry(prev, employeeName),
      );
    },
    [setManualEmployees],
  );

  if (!isOpen || !manualEmployees.length) return null;

  const totalErrors = sumA3ErrorCounts(manualEmployees);

  return createPortal(
    <div
      className="mc-defect-a3-manual-modal-backdrop fixed inset-0 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4"
      style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-defect-a3-manual-list-title"
    >
      <button
        type="button"
        className="absolute inset-0 min-h-full bg-slate-900/45 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
        aria-label={tl("closeA3ManualList", "Đóng")}
      />
      <div
        className="mc-defect-a3-manual-modal-panel relative z-10 flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white sm:rounded-2xl dark:border-slate-700/80 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mc-defect-a3-manual-modal-header flex shrink-0 items-start gap-3 border-b border-slate-200/80 px-4 py-3.5 dark:border-slate-700/80 sm:px-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
              <A3ModalIcon>{ICON_USERS}</A3ModalIcon>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="mc-defect-a3-manual-list-title"
                  className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-50"
                >
                  {tl("a3ManualListModalTitle", "Danh sách nhân viên A3")}
                </h3>
                <span className="mc-defect-a3-manual-modal-badge inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {tl("a3ManualEmployeeCount", "{{count}} nhân viên", {
                    count: manualEmployees.length,
                  })}
                </span>
                {saving ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    {tl("saving", "Đang lưu...")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {tl(
                  "a3ManualListModalSubtitle",
                  "Chỉnh số lỗi hoặc xóa nhân viên trong danh sách in A3.",
                )}
                {" · "}
                {tl("a3ManualTotalErrors", "Tổng lỗi: {{total}}", {
                  total: totalErrors,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={tl("closeA3ManualList", "Đóng")}
          >
            <A3ModalIcon>{ICON_CLOSE}</A3ModalIcon>
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60 sm:px-5">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_36px] items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            <span>{tl("employee", "Nhân viên")}</span>
            <span className="text-center">
              {tl("a3ManualErrorCount", "Số lỗi")}
            </span>
            <span className="sr-only">{tl("actions", "Thao tác")}</span>
          </div>
        </div>

        <div className="mc-defect-a3-manual-modal-list min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
          <ul className="space-y-1.5">
            {manualEmployees.map((entry) => {
              const { employee, errorCount } =
                normalizeA3ManualEmployeeEntry(entry);
              return (
                <li
                  key={employee}
                  className="mc-defect-a3-manual-modal-row grid grid-cols-[minmax(0,1fr)_72px_36px] items-center gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <span
                    className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100"
                    title={employee}
                  >
                    {employee}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={errorCount}
                    disabled={saving}
                    onChange={(event) =>
                      handleErrorCountChange(employee, event.target.value)
                    }
                    className="mc-defect-a3-manual-modal-input h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-1 text-center text-[13px] font-bold tabular-nums text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:bg-slate-900"
                    aria-label={`${tl("a3ManualErrorCount", "Số lỗi")} — ${employee}`}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemove(employee)}
                    aria-label={tl("removeA3Employee", "Xóa {{employee}}", {
                      employee,
                    })}
                    className="mc-defect-a3-manual-modal-remove inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  >
                    <A3ModalIcon>{ICON_TRASH}</A3ModalIcon>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            {tl("closeA3ManualList", "Đóng")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(A3ManualEmployeeListModal);
