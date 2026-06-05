import { getPayrollColWidthPercents } from "@/features/payroll/payrollColumnWidths";
import {
  ATTENDANCE_GRID_COL,
  ATTENDANCE_GRID_COL_COMPACT_WITH_ACTIONS,
  ATTENDANCE_GRID_COL_COMPACT_NO_ACTIONS,
  ATTENDANCE_GRID_COL_NARROW_WITH_ACTIONS,
  ATTENDANCE_GRID_COL_NARROW_NO_ACTIONS,
  ATTENDANCE_GRID_COL_MINIMAL_WITH_ACTIONS,
  ATTENDANCE_GRID_COL_MINIMAL_NO_ACTIONS,
  FULL_ATTENDANCE_ONLY_NO_ACTIONS,
  FULL_ATTENDANCE_ONLY_WITH_ACTIONS,
  COMPACT_ATTENDANCE_ONLY_NO_ACTIONS,
  COMPACT_ATTENDANCE_ONLY_WITH_ACTIONS,
  NARROW_ATTENDANCE_ONLY_NO_ACTIONS,
  NARROW_ATTENDANCE_ONLY_WITH_ACTIONS,
  MINIMAL_ATTENDANCE_ONLY_NO_ACTIONS,
  MINIMAL_ATTENDANCE_ONLY_WITH_ACTIONS,
} from "./gridColumnMaps";
import {
  normalizePercents,
  dropSalaryHoursWidths,
  insertAttendanceOffDayColumnWidths,
} from "./gridColumnHelpers";

export function getAttendanceGridColumnStart(
  key,
  columnPlan,
  showRowModalActions,
  tableVariant = "attendance",
) {
  const payroll = tableVariant === "payroll";
  if (!payroll) {
    if (key === "payrollTotalGcDay" || key === "payrollTotalGcNight") {
      return undefined;
    }
    if (
      key === "workingHours" ||
      key === "dayShiftOvertimeHours" ||
      key === "offDayOvertimeHours" ||
      key === "holidayDayWorkingHours" ||
      key === "holidayNightWorkingHours" ||
      key === "nightShiftWorkingHours" ||
      key === "nightShiftOvertimeHours" ||
      key === "nightShiftOffDayWorkingHours"
    ) {
      return undefined;
    }
    if (columnPlan === "minimal") {
      const map = showRowModalActions
        ? MINIMAL_ATTENDANCE_ONLY_WITH_ACTIONS
        : MINIMAL_ATTENDANCE_ONLY_NO_ACTIONS;
      return map[key];
    }
    if (columnPlan === "narrow") {
      const map = showRowModalActions
        ? NARROW_ATTENDANCE_ONLY_WITH_ACTIONS
        : NARROW_ATTENDANCE_ONLY_NO_ACTIONS;
      if (
        key === "joinDate" ||
        key === "workStatus" ||
        key === "deptCode" ||
        key === "dept"
      )
        return undefined;
      return map[key];
    }
    if (columnPlan === "compact") {
      const map = showRowModalActions
        ? COMPACT_ATTENDANCE_ONLY_WITH_ACTIONS
        : COMPACT_ATTENDANCE_ONLY_NO_ACTIONS;
      if (key === "joinDate" || key === "workStatus" || key === "deptCode")
        return undefined;
      return map[key];
    }
    const map = showRowModalActions
      ? FULL_ATTENDANCE_ONLY_WITH_ACTIONS
      : FULL_ATTENDANCE_ONLY_NO_ACTIONS;
    return map[key];
  }
  if (columnPlan === "minimal") {
    const map = showRowModalActions
      ? ATTENDANCE_GRID_COL_MINIMAL_WITH_ACTIONS
      : ATTENDANCE_GRID_COL_MINIMAL_NO_ACTIONS;
    return map[key];
  }
  if (columnPlan === "narrow") {
    const map = showRowModalActions
      ? ATTENDANCE_GRID_COL_NARROW_WITH_ACTIONS
      : ATTENDANCE_GRID_COL_NARROW_NO_ACTIONS;
    if (
      key === "joinDate" ||
      key === "workStatus" ||
      key === "deptCode" ||
      key === "dept"
    )
      return undefined;
    return map[key];
  }
  if (columnPlan === "compact") {
    const map = showRowModalActions
      ? ATTENDANCE_GRID_COL_COMPACT_WITH_ACTIONS
      : ATTENDANCE_GRID_COL_COMPACT_NO_ACTIONS;
    if (key === "joinDate" || key === "workStatus" || key === "deptCode")
      return undefined;
    return map[key];
  }
  return ATTENDANCE_GRID_COL[key];
}

export function attendanceGridCellStyle(isGrid, col) {
  return isGrid && col != null ? { gridColumnStart: col } : undefined;
}

/** Bảng HTML: luôn render đủ cột + cuộn ngang — tránh lệch colgroup khi ẩn `td`. */
export function cellClsForAttendanceTable(s) {
  return s
    .replace(/hidden md:table-cell/g, "table-cell")
    .replace(/hidden lg:table-cell/g, "table-cell")
    .trim();
}

/** % cột — khớp `SeasonalStaffAttendance` / điểm danh (colgroup/grid). */
const WIDTHS_WITH_ACTIONS = [
  2, 4, 4, 14, 4, 7, 4, 4, 8, 6, 6, 6, 6, 6, 3, 3, 5, 4, 4, 4, 4, 3, 6,
];
const WIDTHS_NO_ACTIONS = [
  2, 4, 4, 17, 4, 4, 4, 3, 8, 6, 6, 6, 6, 5, 3, 3, 4, 4, 4, 4, 3, 7,
];
/** Bỏ mã BP — compact (870–1279). */
const WIDTHS_WITH_ACTIONS_COMPACT = [
  8, 6, 6, 11, 6, 15, 11, 5, 6, 5, 11, 3, 3, 5, 5, 4, 4, 4, 3, 7,
];
const WIDTHS_NO_ACTIONS_COMPACT = [
  8, 6, 6, 17, 6, 15, 11, 5, 7, 5, 5, 3, 3, 5, 4, 4, 4, 3, 11,
];
/** Thêm bỏ bộ phận — narrow (820–869). */
const WIDTHS_NARROW_WITH_ACTIONS = [
  9, 7, 7, 15, 7, 13, 7, 5, 13, 5, 5, 3, 3, 5, 4, 4, 4, 3, 9,
];
const WIDTHS_NARROW_NO_ACTIONS = [
  9, 7, 7, 22, 7, 13, 8, 5, 5, 5, 3, 3, 5, 4, 4, 4, 3, 14,
];
/** Chỉ MNV, họ tên, giờ vào, ca, (hành động) — &lt;820px. */
const WIDTHS_MINIMAL_WITH_ACTIONS = [
  9, 24, 12, 5, 5, 8, 3, 3, 8, 5, 5, 4, 3, 8,
];
const WIDTHS_MINIMAL_NO_ACTIONS = [12, 24, 14, 5, 5, 8, 3, 3, 5, 5, 4, 3, 14];

/**
 * @param {"full"|"compact"|"narrow"|"minimal"} [columnPlan="full"]
 * @param {{ seasonalOmitWorkStatus?: boolean }} [layoutOptions] — điểm danh thời vụ (`full`): không có cột «Trạng thái LV» → bỏ 1 trọng số (khớp số `<col>` với `<th>`).
 */
export function getAttendanceColWidthPercents(
  showRowModalActions,
  columnPlan = "full",
  tableVariant = "attendance",
  layoutOptions = {},
) {
  if (tableVariant === "payroll") {
    return getPayrollColWidthPercents(showRowModalActions, columnPlan);
  }
  let base;
  if (columnPlan === "minimal") {
    base = showRowModalActions
      ? WIDTHS_MINIMAL_WITH_ACTIONS
      : WIDTHS_MINIMAL_NO_ACTIONS;
  } else if (columnPlan === "narrow") {
    base = showRowModalActions
      ? WIDTHS_NARROW_WITH_ACTIONS
      : WIDTHS_NARROW_NO_ACTIONS;
  } else if (columnPlan === "compact") {
    base = showRowModalActions
      ? WIDTHS_WITH_ACTIONS_COMPACT
      : WIDTHS_NO_ACTIONS_COMPACT;
  } else {
    base = showRowModalActions ? WIDTHS_WITH_ACTIONS : WIDTHS_NO_ACTIONS;
  }
  const stripped = dropSalaryHoursWidths(base, showRowModalActions);
  let result = insertAttendanceOffDayColumnWidths(
    stripped,
    showRowModalActions,
    columnPlan,
  );
  if (
    layoutOptions?.seasonalOmitWorkStatus &&
    tableVariant === "attendance" &&
    columnPlan === "full" &&
    result.length > 6
  ) {
    const copy = [...result];
    /** Trùng `FULL_ATTENDANCE_ONLY` cột 7 — `workStatus` — thời vụ không render. */
    copy.splice(6, 1);
    result = normalizePercents(copy);
  }
  return result;
}

/** Chuỗi grid-template-columns — header + hàng virtual dùng chung. */
export function getAttendanceGridTemplateColumns(
  showRowModalActions,
  columnPlan = "full",
  tableVariant = "attendance",
  layoutOptions = {},
) {
  return getAttendanceColWidthPercents(
    showRowModalActions,
    columnPlan,
    tableVariant,
    layoutOptions,
  )
    .map((w) => `${w}%`)
    .join(" ");
}
