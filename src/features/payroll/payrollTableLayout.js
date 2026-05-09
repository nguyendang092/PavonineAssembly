/**
 * Bảng lương: min-width theo `columnPlan` và có/không cột Sửa.
 * Class cố định để Tailwind JIT nhận.
 */
export function payrollTableWrapperMinWidthClass(
  columnPlan,
  showRowModalActions = false,
) {
  switch (columnPlan) {
    case "full":
      return showRowModalActions ? "min-w-[1470px]" : "min-w-[1410px]";
    case "compact":
      return showRowModalActions ? "min-w-[1142px]" : "min-w-[1086px]";
    case "narrow":
      return showRowModalActions ? "min-w-[1002px]" : "min-w-[946px]";
    case "minimal":
      return showRowModalActions ? "min-w-[622px]" : "min-w-[566px]";
    default:
      return showRowModalActions ? "min-w-[1062px]" : "min-w-[1006px]";
  }
}
