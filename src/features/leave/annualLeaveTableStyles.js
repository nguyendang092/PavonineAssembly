/** Header bảng — khớp `AttendanceTableThead` (gradient xanh → tím). */
export const ANNUAL_LEAVE_TABLE_HEADER_GRADIENT =
  "linear-gradient(to right, #3b82f6, #8b5cf6)";

export const annualLeaveTableThClass =
  "px-1 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight";

/** Số cột cố định bên trái (No → BALANCE) — phần còn lại scroll ngang. */
export const ANNUAL_LEAVE_MANAGER_STICKY_COLUMN_COUNT = 10;

export function annualLeaveStickyColClass(colIndex, { header = false, rowIndex = null } = {}) {
  const idx = Number(colIndex);
  if (!Number.isFinite(idx) || idx < 0) return "";
  const classes = [
    "annual-leave-sticky-col",
    `annual-leave-sticky-col-${idx}`,
  ];
  if (header) {
    classes.push("annual-leave-sticky-col-header");
  } else if (rowIndex != null) {
    classes.push(
      Number(rowIndex) % 2 === 0
        ? "annual-leave-sticky-bg-even"
        : "annual-leave-sticky-bg-odd",
    );
  }
  if (idx === ANNUAL_LEAVE_MANAGER_STICKY_COLUMN_COUNT - 1) {
    classes.push("annual-leave-sticky-col-edge");
  }
  return classes.join(" ");
}

export function annualLeaveTableRowClass(index) {
  const stripe =
    Number(index) % 2 === 0
      ? "annual-leave-table-row-even"
      : "annual-leave-table-row-odd";
  return `annual-leave-table-row min-h-8 border-b border-slate-100 dark:border-slate-700/40 ${stripe}`;
}
