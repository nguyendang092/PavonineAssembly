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
      return showRowModalActions ? "min-w-[1880px]" : "min-w-[1810px]";
    case "compact":
      return showRowModalActions ? "min-w-[1420px]" : "min-w-[1350px]";
    case "narrow":
      return showRowModalActions ? "min-w-[1200px]" : "min-w-[1140px]";
    case "minimal":
      return showRowModalActions ? "min-w-[750px]" : "min-w-[680px]";
    default:
      return showRowModalActions ? "min-w-[1270px]" : "min-w-[1210px]";
  }
}
