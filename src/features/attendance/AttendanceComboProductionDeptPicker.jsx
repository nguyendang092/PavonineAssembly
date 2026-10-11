import React, { memo } from "react";
import { mergeComboProductionDeptPickerKeys } from "./attendanceComboChartConfig";

function AttendanceComboProductionDeptPicker({
  open,
  onClose,
  tl,
  comboProductionDeptCatalog,
  productionDeptPickerDraft,
  setProductionDeptPickerDraft,
  productionDeptLabelForPicker,
  toggleProductionDeptDraftKey,
  moveProductionDeptDraftKey,
  onPersistComboProductionDeptOrder,
  onSave,
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
      style={{ zIndex: "var(--z-modal-content, 1210)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="combo-production-dept-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-emerald-500/50 bg-white dark:border-emerald-700/60 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-emerald-50 px-4 py-3 dark:border-slate-700 dark:bg-emerald-950/40">
          <h3
            id="combo-production-dept-picker-title"
            className="text-sm font-bold text-emerald-950 dark:text-emerald-100"
          >
            {tl(
              "comboProductionDeptPickerTitle",
              "Bộ phận sản xuất — Thứ tự hiển thị biểu đồ",
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {tl(
              "comboProductionDeptPickerHint",
              "Chọn bộ phận sản xuất và sắp thứ tự (1, 2, 3,...).",
            )}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {tl("comboProductionDeptPickerSelected", "Đã chọn")}
          </p>
          {productionDeptPickerDraft.length === 0 ? (
            <p className="mb-4 text-xs text-amber-800 dark:text-amber-200">
              {tl(
                "comboProductionDeptPickerEmpty",
                "Chưa chọn — Lưu sẽ dùng danh sách mặc định đầy đủ.",
              )}
            </p>
          ) : (
            <ol className="mb-4 space-y-2">
              {productionDeptPickerDraft.map((mk, idx) => (
                <li
                  key={mk}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800/90"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">
                      {idx + 1}
                    </span>
                    {productionDeptLabelForPicker(mk)}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold disabled:opacity-40 dark:border-slate-600"
                      onClick={() => moveProductionDeptDraftKey(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold disabled:opacity-40 dark:border-slate-600"
                      onClick={() => moveProductionDeptDraftKey(idx, 1)}
                      disabled={idx === productionDeptPickerDraft.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:border-rose-700 dark:text-rose-200"
                      onClick={() => toggleProductionDeptDraftKey(mk)}
                    >
                      {tl("comboProductionDeptPickerRemove", "Bỏ")}
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {tl("comboProductionDeptPickerCatalog", "Danh mục")}
          </p>
          <div className="flex flex-wrap gap-2">
            {comboProductionDeptCatalog.map(({ matchKey: mk, label }) => {
              const selected = productionDeptPickerDraft.indexOf(mk) >= 0;
              return (
                <button
                  key={mk}
                  type="button"
                  onClick={() => toggleProductionDeptDraftKey(mk)}
                  className={`rounded-lg border px-2 py-1 text-xs font-bold transition ${
                    selected
                      ? "border-emerald-600 bg-emerald-500/20 text-emerald-950 dark:border-emerald-500 dark:text-emerald-100"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 px-4 py-3 whitespace-nowrap sm:flex-wrap sm:justify-end sm:overflow-visible dark:border-slate-700 dark:bg-slate-950/80">
          <button
            type="button"
            onClick={() =>
              setProductionDeptPickerDraft(
                mergeComboProductionDeptPickerKeys(comboProductionDeptCatalog),
              )
            }
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {tl("comboProductionDeptPickerReset", "Mặc định")}
          </button>
          <button
            type="button"
            onClick={() => {
              onPersistComboProductionDeptOrder?.([]);
              onClose();
            }}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {tl("comboProductionDeptPickerClearSaved", "Reset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {tl("cancel", "Hủy")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            {tl("save", "Lưu")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AttendanceComboProductionDeptPicker);
