/** Header bảng — khớp `AttendanceTableThead` (gradient xanh → tím). */
export const ANNUAL_LEAVE_TABLE_HEADER_GRADIENT =
  "linear-gradient(to right, #3b82f6, #8b5cf6)";

export const annualLeaveTableThClass =
  "px-1 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-[10px] font-extrabold text-white uppercase tracking-wide text-center leading-tight";

export function annualLeaveTableRowClass(index) {
  return `h-8 transition-colors hover:bg-blue-200 border-b border-slate-100 dark:border-slate-700/40 ${
    index % 2 === 0
      ? "bg-blue-100 dark:bg-slate-800"
      : "bg-white dark:bg-slate-900"
  }`;
}
