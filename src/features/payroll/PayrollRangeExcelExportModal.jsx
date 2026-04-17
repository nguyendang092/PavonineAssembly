import React, { useEffect, useState } from "react";

/**
 * Chọn khoảng ngày xuất Excel bảng lương. Mặc định từ = đến = hôm nay (local).
 * @param {{ open: boolean, onDismiss: () => void, onExport: (from: string, to: string) => void | Promise<void>, todayKey: string, exporting?: boolean, title: string, fromLabel: string, toLabel: string, exportLabel: string, cancelLabel: string }} props
 */
export default function PayrollRangeExcelExportModal({
  open,
  onDismiss,
  onExport,
  todayKey,
  exporting = false,
  title,
  fromLabel,
  toLabel,
  exportLabel,
  cancelLabel,
}) {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);

  useEffect(() => {
    if (!open) return;
    setFrom(todayKey);
    setTo(todayKey);
  }, [open, todayKey]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (exporting) return;
    onExport(from, to);
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-range-export-title"
      onClick={exporting ? undefined : onDismiss}
    >
      <form
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
          <h2
            id="payroll-range-export-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {fromLabel}
            </span>
            <input
              type="date"
              required
              value={from}
              disabled={exporting}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {toLabel}
            </span>
            <input
              type="date"
              required
              value={to}
              disabled={exporting}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            disabled={exporting}
            onClick={onDismiss}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={exporting}
            className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-500"
          >
            {exporting ? "…" : exportLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
