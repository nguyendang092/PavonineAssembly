export const annualLeaveTableThClass =
  "annual-leave-th text-center leading-tight";

/** Chỉ 3 cột cố định khi cuộn ngang: STT, MNV (+ MVT), Họ tên. */
export const ANNUAL_LEAVE_MANAGER_STICKY_COLUMN_INDICES = new Set([0, 1, 2]);

export const ANNUAL_LEAVE_MANAGER_STICKY_EDGE_COLUMN = 2;

export function annualLeaveStickyColClass(
  colIndex,
  { header = false, rowIndex = null } = {},
) {
  const idx = Number(colIndex);
  if (!ANNUAL_LEAVE_MANAGER_STICKY_COLUMN_INDICES.has(idx)) return "";

  const classes = [
    "annual-leave-sticky-col",
    `annual-leave-sticky-col-${idx}`,
  ];
  if (header) {
    classes.push("annual-leave-sticky-col-header");
    classes.push("annual-leave-sticky-corner");
  } else if (rowIndex != null) {
    classes.push(
      Number(rowIndex) % 2 === 0
        ? "annual-leave-sticky-bg-even"
        : "annual-leave-sticky-bg-odd",
    );
  }
  if (idx === ANNUAL_LEAVE_MANAGER_STICKY_EDGE_COLUMN) {
    classes.push("annual-leave-sticky-col-edge");
  }
  return classes.join(" ");
}

export function annualLeaveTableRowClass(index) {
  const stripe =
    Number(index) % 2 === 0
      ? "annual-leave-table-row-even"
      : "annual-leave-table-row-odd";
  return `annual-leave-table-row min-h-8 border-b border-[color:var(--line)] ${stripe}`;
}
