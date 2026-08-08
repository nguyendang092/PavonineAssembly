import React, { memo, useCallback } from "react";
import {
  getYearMonthFromDateKey,
  shiftMonthKey,
} from "@/utils/dateKey";

/**
 * Chọn tháng xem lưới chấm công — `<input type="month">` + nút tháng trước/sau.
 */
function PayrollMonthNavigator({
  monthFirstKey,
  onMonthFirstKeyChange,
  disabled = false,
  tlPage,
  className = "",
}) {
  const monthInputValue = getYearMonthFromDateKey(monthFirstKey);

  const handleMonthInput = useCallback(
    (event) => {
      const ym = String(event.target.value ?? "").trim();
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      onMonthFirstKeyChange(`${ym}-01`);
    },
    [onMonthFirstKeyChange],
  );

  const goPrevMonth = useCallback(() => {
    onMonthFirstKeyChange(shiftMonthKey(monthFirstKey, -1));
  }, [monthFirstKey, onMonthFirstKeyChange]);

  const goNextMonth = useCallback(() => {
    onMonthFirstKeyChange(shiftMonthKey(monthFirstKey, 1));
  }, [monthFirstKey, onMonthFirstKeyChange]);

  const prevLabel = tlPage("monthlyTimesheetPrevMonth", "Tháng trước");
  const nextLabel = tlPage("monthlyTimesheetNextMonth", "Tháng sau");
  const monthLabel = tlPage("monthlyTimesheetMonthPicker", "Chọn tháng xem");

  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 rounded-md border border-indigo-200 bg-white/95 px-0.5 py-0.5 shadow-sm dark:border-indigo-500/40 dark:bg-slate-900/90 ${className}`}
    >
      <button
        type="button"
        onClick={goPrevMonth}
        disabled={disabled}
        aria-label={prevLabel}
        title={prevLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-base font-bold leading-none text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        ‹
      </button>
      <input
        type="month"
        value={monthInputValue}
        onChange={handleMonthInput}
        disabled={disabled}
        aria-label={monthLabel}
        title={monthLabel}
        className="h-7 min-w-0 max-w-[9.5rem] rounded border border-slate-300 bg-white px-1.5 text-xs font-bold text-indigo-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-indigo-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
      />
      <button
        type="button"
        onClick={goNextMonth}
        disabled={disabled}
        aria-label={nextLabel}
        title={nextLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-base font-bold leading-none text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        ›
      </button>
    </div>
  );
}

export default memo(PayrollMonthNavigator);
