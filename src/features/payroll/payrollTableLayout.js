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
      return showRowModalActions ? "min-w-[1520px]" : "min-w-[1460px]";
    case "compact":
      return showRowModalActions ? "min-w-[1192px]" : "min-w-[1136px]";
    case "narrow":
      return showRowModalActions ? "min-w-[1052px]" : "min-w-[996px]";
    case "minimal":
      return showRowModalActions ? "min-w-[672px]" : "min-w-[616px]";
    default:
      return showRowModalActions ? "min-w-[1112px]" : "min-w-[1056px]";
  }
}
