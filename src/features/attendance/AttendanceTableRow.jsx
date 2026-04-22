import React, { memo } from "react";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeColorClassNameForEmployee,
} from "./attendanceGioVaoTypeOptions";
import {
  formatPayrollDayOvertimeHoursCell,
  formatPayrollTableHolidayDayWorkingCell,
  formatPayrollTableHolidayNightWorkingCell,
  formatPayrollTableNightShiftOffDayWorkingCell,
  formatPayrollTableNightShiftOvertimeCell,
  formatPayrollTableNightShiftWorkingCell,
  formatPayrollTableOffDayTcCell,
  formatPayrollTableTotalDayGcCell,
  formatPayrollTableTotalNightGcCell,
  formatPayrollTableWorkingHoursCell,
} from "./attendanceWorkingHours";
import { getPayrollColWidthPercents } from "@/features/payroll/payrollColumnWidths";
import { formatTrangThaiLamViecTableCell } from "./attendanceEmploymentStatus";

const PAYROLL_EMPTY_CELL = "-";
/** Điểm danh: ô trống / không nhập giờ — chỉnh sửa qua nút Sửa. */
const ATTENDANCE_EMPTY_CELL = "-";

/** Bảng lương: null / chỉ khoảng trắng / chuỗi rỗng → `-`. Điểm danh: giữ nguyên. */
function payrollDash(value, isPayroll) {
  if (!isPayroll) return value;
  if (value === null || value === undefined) return PAYROLL_EMPTY_CELL;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : PAYROLL_EMPTY_CELL;
  }
  const s = String(value).trim();
  if (s === "") return PAYROLL_EMPTY_CELL;
  return s;
}

/** Ngưỡng: danh sách lớn hơn số này dùng virtual scroll (xem AttendanceList). */
export const ATTENDANCE_VIRTUAL_THRESHOLD = 300;

/**
 * Chỉ số cột grid (1-based). Khi một số ô `display:none`, auto-placement làm lệch % —
 * buộc mỗi ô đúng track để khớp `grid-template-columns`.
 */
const ATTENDANCE_GRID_COL = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  joinDate: 6,
  workStatus: 7,
  deptCode: 8,
  dept: 9,
  timeIn: 10,
  timeOut: 11,
  leaveType: 12,
  shift: 13,
  /** Cùng dòng ngày: tick «Ngày off» ở Điểm danh → hiển thị OFF. */
  offDay: 14,
  holidayDay: 15,
  workingHours: 16,
  overtimeHours: 17,
  offDayOvertimeHours: 18,
  holidayDayWorkingHours: 19,
  payrollTotalGcDay: 20,
  nightShiftWorkingHours: 21,
  nightShiftOvertimeHours: 22,
  nightShiftOffDayWorkingHours: 23,
  holidayNightWorkingHours: 24,
  payrollTotalGcNight: 25,
  actions: 26,
};

/** Cùng thứ tự cột nhưng bỏ mã BP — % chia lại tròn 100. */
const ATTENDANCE_GRID_COL_COMPACT_WITH_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  dept: 6,
  timeIn: 7,
  timeOut: 8,
  leaveType: 9,
  shift: 10,
  offDay: 11,
  holidayDay: 12,
  workingHours: 13,
  overtimeHours: 14,
  offDayOvertimeHours: 15,
  holidayDayWorkingHours: 16,
  payrollTotalGcDay: 17,
  nightShiftWorkingHours: 18,
  nightShiftOvertimeHours: 19,
  nightShiftOffDayWorkingHours: 20,
  holidayNightWorkingHours: 21,
  payrollTotalGcNight: 22,
  actions: 23,
};

const ATTENDANCE_GRID_COL_COMPACT_NO_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  dept: 6,
  timeIn: 7,
  timeOut: 8,
  leaveType: 9,
  shift: 10,
  offDay: 11,
  holidayDay: 12,
  workingHours: 13,
  overtimeHours: 14,
  offDayOvertimeHours: 15,
  holidayDayWorkingHours: 16,
  payrollTotalGcDay: 17,
  nightShiftWorkingHours: 18,
  nightShiftOvertimeHours: 19,
  nightShiftOffDayWorkingHours: 20,
  holidayNightWorkingHours: 21,
  payrollTotalGcNight: 22,
};

/** Ẩn mã BP + bộ phận — 9 cột (có Sửa) hoặc 8 cột. */
const ATTENDANCE_GRID_COL_NARROW_WITH_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  timeIn: 6,
  timeOut: 7,
  leaveType: 8,
  shift: 9,
  offDay: 10,
  holidayDay: 11,
  workingHours: 12,
  overtimeHours: 13,
  offDayOvertimeHours: 14,
  holidayDayWorkingHours: 15,
  payrollTotalGcDay: 16,
  nightShiftWorkingHours: 17,
  nightShiftOvertimeHours: 18,
  nightShiftOffDayWorkingHours: 19,
  holidayNightWorkingHours: 20,
  payrollTotalGcNight: 21,
  actions: 22,
};

const ATTENDANCE_GRID_COL_NARROW_NO_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  timeIn: 6,
  timeOut: 7,
  leaveType: 8,
  shift: 9,
  offDay: 10,
  holidayDay: 11,
  workingHours: 12,
  overtimeHours: 13,
  offDayOvertimeHours: 14,
  holidayDayWorkingHours: 15,
  payrollTotalGcDay: 16,
  nightShiftWorkingHours: 17,
  nightShiftOvertimeHours: 18,
  nightShiftOffDayWorkingHours: 19,
  holidayNightWorkingHours: 20,
  payrollTotalGcNight: 21,
};

const ATTENDANCE_GRID_COL_MINIMAL_WITH_ACTIONS = {
  mnv: 1,
  fullName: 2,
  timeIn: 3,
  leaveType: 4,
  shift: 5,
  offDay: 6,
  holidayDay: 7,
  workingHours: 8,
  overtimeHours: 9,
  offDayOvertimeHours: 10,
  holidayDayWorkingHours: 11,
  payrollTotalGcDay: 12,
  nightShiftWorkingHours: 13,
  nightShiftOvertimeHours: 14,
  nightShiftOffDayWorkingHours: 15,
  holidayNightWorkingHours: 16,
  payrollTotalGcNight: 17,
  actions: 18,
};

const ATTENDANCE_GRID_COL_MINIMAL_NO_ACTIONS = {
  mnv: 1,
  fullName: 2,
  timeIn: 3,
  leaveType: 4,
  shift: 5,
  offDay: 6,
  holidayDay: 7,
  workingHours: 8,
  overtimeHours: 9,
  offDayOvertimeHours: 10,
  holidayDayWorkingHours: 11,
  payrollTotalGcDay: 12,
  nightShiftWorkingHours: 13,
  nightShiftOvertimeHours: 14,
  nightShiftOffDayWorkingHours: 15,
  holidayNightWorkingHours: 16,
  payrollTotalGcNight: 17,
};

/** Điểm danh: thêm cột Ngày off (OFF) — không khối cột giờ lương (khớp `dropSalaryHoursWidths` + chèn off). */
const FULL_ATTENDANCE_ONLY_NO_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  joinDate: 6,
  workStatus: 7,
  deptCode: 8,
  dept: 9,
  timeIn: 10,
  timeOut: 11,
  leaveType: 12,
  shift: 13,
  offDay: 14,
  holidayDay: 15,
};
const FULL_ATTENDANCE_ONLY_WITH_ACTIONS = {
  ...FULL_ATTENDANCE_ONLY_NO_ACTIONS,
  actions: 16,
};
const COMPACT_ATTENDANCE_ONLY_NO_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  dept: 6,
  timeIn: 7,
  timeOut: 8,
  leaveType: 9,
  shift: 10,
  offDay: 11,
  holidayDay: 12,
};
const COMPACT_ATTENDANCE_ONLY_WITH_ACTIONS = {
  ...COMPACT_ATTENDANCE_ONLY_NO_ACTIONS,
  actions: 13,
};
const NARROW_ATTENDANCE_ONLY_NO_ACTIONS = {
  stt: 1,
  mnv: 2,
  mvt: 3,
  fullName: 4,
  gender: 5,
  timeIn: 6,
  timeOut: 7,
  leaveType: 8,
  shift: 9,
  offDay: 10,
  holidayDay: 11,
};
const NARROW_ATTENDANCE_ONLY_WITH_ACTIONS = {
  ...NARROW_ATTENDANCE_ONLY_NO_ACTIONS,
  actions: 12,
};
const MINIMAL_ATTENDANCE_ONLY_NO_ACTIONS = {
  mnv: 1,
  fullName: 2,
  timeIn: 3,
  leaveType: 4,
  shift: 5,
  offDay: 6,
  holidayDay: 7,
};
const MINIMAL_ATTENDANCE_ONLY_WITH_ACTIONS = {
  ...MINIMAL_ATTENDANCE_ONLY_NO_ACTIONS,
  actions: 8,
};

function normalizePercents(widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) return widths;
  return widths.map((w) => (w / sum) * 100);
}

/** Số cột bảng điểm danh (không khối giờ lương payroll) — phải khớp `*ATTENDANCE_ONLY*` grid. */
function getAttendanceVisibleColumnCount(showRowModalActions, columnPlan) {
  const plan =
    columnPlan === "minimal"
      ? "minimal"
      : columnPlan === "narrow"
        ? "narrow"
        : columnPlan === "compact"
          ? "compact"
          : "full";
  const table = {
    full: { withAct: 16, noAct: 15 },
    compact: { withAct: 13, noAct: 12 },
    narrow: { withAct: 12, noAct: 11 },
    minimal: { withAct: 8, noAct: 7 },
  };
  const row = table[plan];
  return showRowModalActions ? row.withAct : row.noAct;
}

/** Bỏ khối cột giờ lương (ghost, trước actions nếu có) — khớp số cột giờ trên bảng lương. */
function dropSalaryHoursWidths(widths, showRowModalActions) {
  const dropCount = 8;
  if (widths.length === 0) return widths;
  const copy = [...widths];
  if (showRowModalActions) {
    if (copy.length >= dropCount + 1)
      copy.splice(copy.length - (dropCount + 1), dropCount);
  } else if (copy.length >= dropCount) {
    copy.splice(copy.length - dropCount, dropCount);
  }
  return normalizePercents(copy);
}

/**
 * Sau `dropSalaryHoursWidths`, bảng payroll vẫn giữ width «Ngày off» trước khối giờ đã xóa;
 * chỉ cần bù thêm «Ngày lễ» (và không chèn trùng) để số track = số ô grid (tránh cột ma + khoảng trống phải).
 */
function insertAttendanceOffDayColumnWidths(
  widths,
  showRowModalActions,
  columnPlan = "full",
) {
  if (widths.length < 1) return widths;
  const expected = getAttendanceVisibleColumnCount(
    showRowModalActions,
    columnPlan,
  );
  const copy = [...widths];
  if (copy.length === expected) return normalizePercents(copy);

  const padWeight = 4;

  if (copy.length < expected) {
    const deficit = expected - copy.length;
    const pad = Array(deficit).fill(padWeight);
    if (showRowModalActions) {
      copy.splice(copy.length - 1, 0, ...pad);
    } else {
      copy.splice(copy.length, 0, ...pad);
    }
    return normalizePercents(copy);
  }

  const surplus = copy.length - expected;
  if (showRowModalActions) {
    copy.splice(copy.length - 1 - surplus, surplus);
  } else {
    copy.splice(copy.length - surplus - 1, surplus);
  }
  return normalizePercents(copy);
}

/**
 * Cột grid theo `columnPlan` — khi ô không render, không dùng key đó (compact/ narrow/ minimal bỏ bớt cột).
 * @param {"attendance"|"payroll"} [tableVariant="attendance"] — payroll: đủ cột giờ (GC ngày lễ / GC ca đêm lễ, …).
 */
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
      key === "overtimeHours" ||
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

function attendanceGridCellStyle(isGrid, col) {
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
  10, 18, 12, 5, 5, 12, 8, 3, 3, 8, 5, 5, 4, 3, 18,
];
const WIDTHS_MINIMAL_NO_ACTIONS = [
  16, 16, 14, 5, 5, 12, 8, 3, 3, 5, 5, 4, 3, 14,
];

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

/** Cố định % cột — bảng không virtual. */
export function AttendanceTableColgroup({
  showRowModalActions,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const widths = getAttendanceColWidthPercents(
    showRowModalActions,
    columnPlan,
    tableVariant,
  );
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

function cellClsForGrid(virtual, s, minimal = false) {
  if (!virtual) return s;
  if (minimal) {
    let out = s
      .replace(
        /hidden md:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .replace(
        /hidden lg:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .replace(
        /hidden xl:table-cell/g,
        "flex min-w-0 items-center justify-center",
      )
      .trim();
    if (out.includes("text-left md:text-center")) {
      out = `${out} flex items-center justify-start md:justify-center`;
    } else if (/\btext-center\b/.test(out) && !out.includes("justify-")) {
      out = `${out} flex items-center justify-center`;
    } else if (!/\bflex\b/.test(out)) {
      out = `${out} flex items-center`;
    }
    return `${out} min-w-0`;
  }
  let out = s
    .replace(
      /hidden md:table-cell/g,
      "hidden md:flex md:items-center md:justify-center",
    )
    .replace(
      /hidden lg:table-cell/g,
      "hidden lg:flex lg:items-center lg:justify-center",
    )
    .replace(
      /hidden xl:table-cell/g,
      "hidden xl:flex xl:items-center xl:justify-center",
    )
    .trim();
  if (out.includes("text-left md:text-center")) {
    out = `${out} flex items-center justify-start md:justify-center`;
  } else if (/\btext-center\b/.test(out) && !out.includes("justify-")) {
    out = `${out} flex items-center justify-center`;
  } else if (!/\bflex\b/.test(out)) {
    out = `${out} flex items-center`;
  }
  return `${out} min-w-0`;
}

/** Tiêu đề dạng CSS Grid — dùng cùng template % với hàng virtual. */
export function AttendanceVirtualHeader({
  tl,
  showRowModalActions,
  gridTemplateColumns,
  canDeleteRow = true,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  const gcs = (key) =>
    getAttendanceGridColumnStart(
      key,
      columnPlan,
      showRowModalActions,
      tableVariant,
    );

  if (columnPlan === "minimal") {
    return (
      <div
        role="row"
        className="sticky top-0 z-20 grid w-full border-b border-slate-200 shadow-sm dark:border-slate-600"
        style={{
          gridTemplateColumns,
          background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
        }}
      >
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("mnv") }}
          className="flex min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("mnv", "MNV")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("fullName") }}
          className="flex min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("fullName", "Họ và tên")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("timeIn") }}
          className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("timeIn", "Thời gian vào")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("leaveType") }}
          className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
          title={tl(
            "leaveTypeColumnHint",
            "Loại phép / trạng thái (PN, …) — tách khỏi giờ vào.",
          )}
        >
          {tl("leaveTypeColumn", "Loại phép")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("shift") }}
          className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("workShift", "Ca làm việc")}
        </div>
        {!isPayroll ? (
          <>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("offDay") }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </div>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("holidayDay") }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </div>
          </>
        ) : null}
        {isPayroll ? (
          <>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("offDay") }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </div>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("holidayDay") }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("workingHours"),
                background: "#facc15",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollWorkingHoursHint",
                "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
              )}
            >
              {tl("workingHours", "Giờ công")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("overtimeHours"),
                background: "#fb923c",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "overtimeHoursHint",
                "Giờ ra sau 17:30: tính từ 17:00, cứ 30 phút = 0,5 giờ tăng ca.",
              )}
            >
              {tl("overtimeHours", "Giờ TC")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("offDayOvertimeHours"),
                background: "#c4b5fd",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollOffDayTcHint",
                "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("offDayOvertimeHours", "TC off")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("holidayDayWorkingHours"),
                background: "#6ee7b7",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollHolidayDayWorkingHoursHint",
                "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("holidayDayWorkingHours", "GC ngày lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("payrollTotalGcDay"),
                background: "#38bdf8",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollTotalGcDayHint",
                "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
              )}
            >
              {tl("payrollTotalGcDay", "Tổng GC")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftWorkingHours"),
                background: "#2dd4bf",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftWorkingHoursHint",
                "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
              )}
            >
              {tl("nightShiftWorkingHours", "GC ca đêm")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftOvertimeHours"),
                background: "#e879f9",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftOvertimeHoursHint",
                "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
              )}
            >
              {tl("nightShiftOvertimeHours", "TC ca đêm")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftOffDayWorkingHours"),
                background: "#6ee7b7",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftOffDayWorkingHoursHint",
                "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
              )}
            >
              {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("holidayNightWorkingHours"),
                background: "#a3e635",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollHolidayNightWorkingHoursHint",
                "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
              )}
            >
              {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("payrollTotalGcNight"),
                background: "#818cf8",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollTotalGcNightHint",
                "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
              )}
            >
              {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
            </div>
          </>
        ) : null}
        {showRowModalActions ? (
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("actions") }}
            className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
          >
            {canDeleteRow
              ? tl("actions", "Sửa / Xóa")
              : tl("actionsEditOnly", "Sửa")}
          </div>
        ) : null}
      </div>
    );
  }

  /** Layout full: Ngày vào làm, trạng thái LV, mã BP (+ bộ phận ở cột riêng). */
  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";

  return (
    <div
      role="row"
      className="sticky top-0 z-20 grid w-full border-b border-slate-200 shadow-sm dark:border-slate-600"
      style={{
        gridTemplateColumns,
        background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
      }}
    >
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("stt") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("stt", "STT")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("mnv") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("mnv", "MNV")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("mvt") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs uppercase"
      >
        {tl("mvt", "MVT")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("fullName") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("fullName", "Họ và tên")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("gender") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs uppercase"
      >
        {tl("gender", "Giới tính")}
      </div>
      {showJoinWorkStatusDeptBlock ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("joinDate") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("joinDate", "Ngày vào làm")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("workStatus") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("workStatusColumn", "Trạng thái LV")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("deptCode") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("departmentCode", "Mã BP")}
          </div>
        </>
      ) : null}
      {showDeptColumn ? (
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("dept") }}
          className="hidden min-w-0 items-center justify-center py-px px-1.5 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("department", "Bộ phận")}
        </div>
      ) : null}
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("timeIn") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("timeIn", "Thời gian vào")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("timeOut") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("timeOut", "Thời gian ra")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("leaveType") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        title={tl(
          "leaveTypeColumnHint",
          "Loại phép / trạng thái (PN, …) — sau giờ ra.",
        )}
      >
        {tl("leaveTypeColumn", "Loại phép")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("shift") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("workShift", "Ca làm việc")}
      </div>
      {!isPayroll ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("offDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            {tl("offDayColumn", "Ngày off")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("holidayDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
            )}
          >
            {tl("holidayDayColumn", "Ngày lễ")}
          </div>
        </>
      ) : null}
      {isPayroll ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("offDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            {tl("offDayColumn", "Ngày off")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("holidayDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
            )}
          >
            {tl("holidayDayColumn", "Ngày lễ")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("workingHours"),
              background: "#facc15",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollWorkingHoursHint",
              "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
            )}
          >
            {tl("workingHours", "Giờ công")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("overtimeHours"),
              background: "#fb923c",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "overtimeHoursHint",
              "Giờ ra sau 17:30: tính từ 17:00, cứ 30 phút = 0,5 giờ tăng ca.",
            )}
          >
            {tl("overtimeHours", "Giờ TC")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("offDayOvertimeHours"),
              background: "#c4b5fd",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollOffDayTcHint",
              "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
            )}
          >
            {tl("offDayOvertimeHours", "TC off")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("holidayDayWorkingHours"),
              background: "#6ee7b7",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollHolidayDayWorkingHoursHint",
              "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
            )}
          >
            {tl("holidayDayWorkingHours", "Giờ công ngày lễ")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("payrollTotalGcDay"),
              background: "#38bdf8",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollTotalGcDayHint",
              "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
            )}
          >
            {tl("payrollTotalGcDay", "Tổng GC")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftWorkingHours"),
              background: "#2dd4bf",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftWorkingHoursHint",
              "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
            )}
          >
            {tl("nightShiftWorkingHours", "GC ca đêm")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftOvertimeHours"),
              background: "#e879f9",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftOvertimeHoursHint",
              "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
            )}
          >
            {tl("nightShiftOvertimeHours", "TC ca đêm")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftOffDayWorkingHours"),
              background: "#6ee7b7",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftOffDayWorkingHoursHint",
              "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
            )}
          >
            {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("holidayNightWorkingHours"),
              background: "#a3e635",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollHolidayNightWorkingHoursHint",
              "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
            )}
          >
            {tl("holidayNightWorkingHours", "Giờ công ca đêm ngày lễ (X2.7)")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("payrollTotalGcNight"),
              background: "#818cf8",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollTotalGcNightHint",
              "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
            )}
          >
            {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
          </div>
        </>
      ) : null}
      {showRowModalActions ? (
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("actions") }}
          className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
        >
          {canDeleteRow
            ? tl("actions", "Sửa / Xóa")
            : tl("actionsEditOnly", "Sửa")}
        </div>
      ) : null}
    </div>
  );
}

/** Hàng tiêu đề bảng điểm danh — dùng chung 1 bảng khi không virtual. */
export function AttendanceTableThead({
  tl,
  showRowModalActions,
  stickyHeader,
  canDeleteRow = true,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  if (columnPlan === "minimal") {
    return (
      <thead
        className={
          stickyHeader
            ? "sticky top-0 z-20"
            : "border-b border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900"
        }
      >
        <tr
          style={{
            background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
          }}
        >
          <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
            {tl("mnv", "MNV")}
          </th>
          <th className="px-1 md:px-2 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
            {tl("fullName", "Họ và tên")}
          </th>
          <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
            {tl("timeIn", "Thời gian vào")}
          </th>
          <th
            className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
            title={tl(
              "leaveTypeColumnHint",
              "Loại phép / trạng thái (PN, …) — tách khỏi giờ vào.",
            )}
          >
            {tl("leaveTypeColumn", "Loại phép")}
          </th>
          <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
            {tl("workShift", "Ca làm việc")}
          </th>
          {!isPayroll ? (
            <>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "offDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
                )}
              >
                {tl("offDayColumn", "Ngày off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "holidayDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
                )}
              >
                {tl("holidayDayColumn", "Ngày lễ")}
              </th>
            </>
          ) : null}
          {isPayroll ? (
            <>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "offDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
                )}
              >
                {tl("offDayColumn", "Ngày off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "holidayDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
                )}
              >
                {tl("holidayDayColumn", "Ngày lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900"
                style={{ background: "#facc15" }}
                title={tl(
                  "payrollWorkingHoursHint",
                  "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
                )}
              >
                {tl("workingHours", "Giờ công")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900"
                style={{ background: "#fb923c" }}
                title={tl(
                  "overtimeHoursHint",
                  "Giờ ra sau 17:30: tính từ 17:00, cứ 30 phút = 0,5 giờ tăng ca.",
                )}
              >
                {tl("overtimeHours", "Giờ TC")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#c4b5fd" }}
                title={tl(
                  "payrollOffDayTcHint",
                  "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
                )}
              >
                {tl("offDayOvertimeHours", "TC off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#6ee7b7" }}
                title={tl(
                  "payrollHolidayDayWorkingHoursHint",
                  "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
                )}
              >
                {tl("holidayDayWorkingHours", "GC ngày lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#38bdf8" }}
                title={tl(
                  "payrollTotalGcDayHint",
                  "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
                )}
              >
                {tl("payrollTotalGcDay", "Tổng GC")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#2dd4bf" }}
                title={tl(
                  "nightShiftWorkingHoursHint",
                  "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
                )}
              >
                {tl("nightShiftWorkingHours", "GC ca đêm")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#e879f9" }}
                title={tl(
                  "nightShiftOvertimeHoursHint",
                  "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
                )}
              >
                {tl("nightShiftOvertimeHours", "TC ca đêm")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#6ee7b7" }}
                title={tl(
                  "nightShiftOffDayWorkingHoursHint",
                  "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
                )}
              >
                {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#a3e635" }}
                title={tl(
                  "payrollHolidayNightWorkingHoursHint",
                  "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
                )}
              >
                {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#818cf8" }}
                title={tl(
                  "payrollTotalGcNightHint",
                  "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
                )}
              >
                {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
              </th>
            </>
          ) : null}
          {showRowModalActions && (
            <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
              {canDeleteRow
                ? tl("actions", "Sửa / Xóa")
                : tl("actionsEditOnly", "Sửa")}
            </th>
          )}
        </tr>
      </thead>
    );
  }

  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";

  return (
    <thead
      className={
        stickyHeader
          ? "sticky top-0 z-20"
          : "border-b border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900"
      }
    >
      <tr
        style={{
          background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
        }}
      >
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("stt", "STT")}
        </th>
        <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
          {tl("mnv", "MNV")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("mvt", "MVT")}
        </th>
        <th className="px-1 md:px-2 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
          {tl("fullName", "Họ và tên")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("gender", "Giới tính")}
        </th>
        {showJoinWorkStatusDeptBlock ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("joinDate", "Ngày vào làm")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("workStatusColumn", "Trạng thái LV")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("departmentCode", "Mã BP")}
            </th>
          </>
        ) : null}
        {showDeptColumn ? (
          <th
            className={cellClsForAttendanceTable(
              "hidden md:table-cell px-1.5 md:px-2 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
            )}
          >
            {tl("department", "Bộ phận")}
          </th>
        ) : null}
        <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
          {tl("timeIn", "Thời gian vào")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("timeOut", "Thời gian ra")}
        </th>
        <th
          className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
          title={tl(
            "leaveTypeColumnHint",
            "Loại phép / trạng thái (PN, …) — sau giờ ra.",
          )}
        >
          {tl("leaveTypeColumn", "Loại phép")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("workShift", "Ca làm việc")}
        </th>
        {!isPayroll ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </th>
          </>
        ) : null}
        {isPayroll ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#facc15" }}
              title={tl(
                "payrollWorkingHoursHint",
                "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
              )}
            >
              {tl("workingHours", "Giờ công")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#fb923c" }}
              title={tl(
                "overtimeHoursHint",
                "Giờ ra sau 17:30: tính từ 17:00, cứ 30 phút = 0,5 giờ tăng ca.",
              )}
            >
              {tl("overtimeHours", "Giờ TC")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#c4b5fd" }}
              title={tl(
                "payrollOffDayTcHint",
                "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("offDayOvertimeHours", "TC off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#6ee7b7" }}
              title={tl(
                "payrollHolidayDayWorkingHoursHint",
                "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("holidayDayWorkingHours", "GC ngày lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#38bdf8" }}
              title={tl(
                "payrollTotalGcDayHint",
                "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
              )}
            >
              {tl("payrollTotalGcDay", "Tổng GC")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#2dd4bf" }}
              title={tl(
                "nightShiftWorkingHoursHint",
                "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
              )}
            >
              {tl("nightShiftWorkingHours", "GC ca đêm")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#e879f9" }}
              title={tl(
                "nightShiftOvertimeHoursHint",
                "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
              )}
            >
              {tl("nightShiftOvertimeHours", "TC ca đêm")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#6ee7b7" }}
              title={tl(
                "nightShiftOffDayWorkingHoursHint",
                "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
              )}
            >
              {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#a3e635" }}
              title={tl(
                "payrollHolidayNightWorkingHoursHint",
                "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
              )}
            >
              {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#818cf8" }}
              title={tl(
                "payrollTotalGcNightHint",
                "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
              )}
            >
              {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
            </th>
          </>
        ) : null}
        {showRowModalActions && (
          <th
            className={cellClsForAttendanceTable(
              "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
            )}
          >
            {canDeleteRow
              ? tl("actions", "Sửa / Xóa")
              : tl("actionsEditOnly", "Sửa")}
          </th>
        )}
      </tr>
    </thead>
  );
}

/**
 * Một hàng bảng điểm danh — tách để React.memo + virtual hóa chỉ mount hàng nhìn thấy.
 * Virtual: div + CSS Grid (cùng template với AttendanceVirtualHeader) — không dùng <tr> absolute.
 */
function AttendanceTableRow({
  emp,
  idx,
  virtualRow,
  showRowModalActions,
  columnPlan = "full",
  user,
  canEdit,
  tl,
  t,
  onEdit,
  onDelete,
  canDeleteRow = true,
  measureElementRef,
  gridTemplateColumns,
  isOffDay = false,
  isHolidayDay = false,
  tableVariant = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  const payrollOffLike = isOffDay || isHolidayDay;
  /** Bảng lương: cỡ nhỏ hơn ô MNV; `payroll-tight-time` + payrollTableCompact.css */
  const payrollTimeShiftFont = isPayroll
    ? "payroll-tight-time leading-tight"
    : "text-xs md:text-sm";
  const isGrid = virtualRow != null;
  const isMinimal = columnPlan === "minimal";
  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";
  const Row = isGrid ? "div" : "tr";
  const Cell = isGrid ? "div" : "td";
  const cellCls = (s) =>
    isGrid ? cellClsForGrid(true, s, isMinimal) : cellClsForAttendanceTable(s);

  const gcs = (key) =>
    getAttendanceGridColumnStart(
      key,
      columnPlan,
      showRowModalActions,
      tableVariant,
    );

  const gioVaoTrimmed =
    emp.gioVao != null && String(emp.gioVao).trim() !== ""
      ? String(emp.gioVao).trim()
      : "";
  const timeInCol = formatAttendanceTimeInColumnDisplay(gioVaoTrimmed);
  const leaveTypeCol = formatAttendanceLeaveTypeColumnForEmployee(emp);
  const leaveTypeColorClass =
    getAttendanceLeaveTypeColorClassNameForEmployee(emp);
  const caLamViecTrimmed =
    emp.caLamViec != null && String(emp.caLamViec).trim() !== ""
      ? String(emp.caLamViec).trim()
      : "";

  const rowStyle = isGrid
    ? {
        display: "grid",
        gridTemplateColumns,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        boxSizing: "border-box",
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
        alignItems: "center",
      }
    : undefined;

  return (
    <Row
      ref={measureElementRef}
      data-index={virtualRow != null ? idx : undefined}
      style={rowStyle}
      role={isGrid ? "row" : undefined}
      className={`transition-colors hover:bg-blue-200 border-b border-slate-100 dark:border-slate-700/40 ${
        idx % 2 === 0
          ? "bg-blue-100 dark:bg-slate-800"
          : "bg-white dark:bg-slate-900"
      }`}
    >
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("stt"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center font-bold text-gray-700",
          )}
        >
          {emp.stt || idx + 1}
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("mnv"))}
        className={cellCls(
          "px-1 md:px-1.5 py-px text-xs md:text-sm text-center font-bold text-blue-600 whitespace-nowrap",
        )}
      >
        {payrollDash(emp.mnv, isPayroll)}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("mvt"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold text-gray-700",
          )}
        >
          {payrollDash(emp.mvt, isPayroll)}
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("fullName"))}
        className={cellCls(
          "px-1 md:px-2 py-px text-xs md:text-sm text-left md:text-center font-bold text-gray-800 break-words whitespace-normal leading-tight",
        )}
      >
        {payrollDash(emp.hoVaTen, isPayroll)}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("gender"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center",
          )}
        >
          {isPayroll && !String(emp.gioiTinh ?? "").trim() ? (
            <span className="text-gray-500 tabular-nums">
              {PAYROLL_EMPTY_CELL}
            </span>
          ) : (
            <span
              className={`inline-flex items-center justify-center px-1 py-px text-[10px] font-bold leading-none rounded-full ${
                emp.gioiTinh === "YES"
                  ? "bg-pink-100 text-pink-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {payrollDash(emp.gioiTinh, isPayroll)}
            </span>
          )}
        </Cell>
      ) : null}
      {showJoinWorkStatusDeptBlock ? (
        <>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("joinDate"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold text-gray-700",
            )}
          >
            {payrollDash(emp.ngayVaoLam, isPayroll)}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("workStatus"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-center text-[11px] font-semibold leading-tight text-gray-800",
            )}
          >
            {payrollDash(
              formatTrangThaiLamViecTableCell(emp.trangThaiLamViec, tl),
              isPayroll,
            )}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("deptCode"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-bold text-gray-700",
            )}
          >
            {payrollDash(emp.maBoPhan, isPayroll)}
          </Cell>
        </>
      ) : null}
      {showDeptColumn ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("dept"))}
          className={cellCls(
            "hidden md:table-cell px-1.5 md:px-2 py-px text-sm text-center font-semibold text-gray-700",
          )}
        >
          {payrollDash(emp.boPhan, isPayroll)}
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("timeIn"))}
        className={cellCls(
          `min-w-0 px-1 md:px-1.5 py-px ${payrollTimeShiftFont} text-center`,
        )}
        title={tl(
          "timeInColumnHint",
          "Giờ vào dạng HH:MM — chỉnh sửa qua nút Sửa khi được phép.",
        )}
      >
        {timeInCol ? (
          <span
            className={
              isPayroll
                ? `font-bold ${payrollTimeShiftFont} text-green-600`
                : "font-bold text-sm md:text-base text-green-600"
            }
          >
            {timeInCol}
          </span>
        ) : canEdit && isPayroll ? (
          <span
            className="text-gray-500 italic text-xs"
            title={tl(
              "gioVaoEditOnlyViaModalHint",
              "Chưa nhập giờ vào — mở form qua nút Sửa (cột thao tác).",
            )}
          >
            {tl("emptyUseEditButton", PAYROLL_EMPTY_CELL)}
          </span>
        ) : canEdit && !isPayroll ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "gioVaoEditOnlyViaModalHint",
              "Chưa có giờ vào — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">{PAYROLL_EMPTY_CELL}</span>
        )}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("timeOut"))}
          className={cellCls(
            `hidden md:table-cell px-1 md:px-1.5 py-px ${payrollTimeShiftFont} text-center min-w-0`,
          )}
        >
          <span
            className={
              isPayroll
                ? `text-red-600 font-bold ${payrollTimeShiftFont}`
                : "text-red-600 font-bold text-base"
            }
          >
            {payrollDash(emp.gioRa, isPayroll)}
          </span>
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("leaveType"))}
        className={cellCls(
          `min-w-0 px-1 md:px-1.5 py-px ${payrollTimeShiftFont} text-center`,
        )}
        title={tl(
          "leaveTypeColumnHint",
          "Loại phép / trạng thái chấm công — chỉnh sửa qua nút Sửa khi được phép.",
        )}
      >
        {leaveTypeCol ? (
          <span
            className={
              isPayroll
                ? `font-bold ${payrollTimeShiftFont} ${leaveTypeColorClass}`
                : `font-bold text-sm md:text-base ${leaveTypeColorClass}`
            }
          >
            {leaveTypeCol}
          </span>
        ) : isPayroll ? (
          <span
            className="text-gray-500 tabular-nums"
            title={
              canEdit
                ? tl(
                    "leaveTypeEditViaModalHint",
                    "Loại phép — mở form qua nút Sửa (cột thao tác).",
                  )
                : undefined
            }
          >
            {PAYROLL_EMPTY_CELL}
          </span>
        ) : canEdit ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "leaveTypeEditViaModalHint",
              "Chưa có loại phép — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">{PAYROLL_EMPTY_CELL}</span>
        )}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("shift"))}
        className={cellCls(
          `hidden md:table-cell px-px md:px-0.5 py-px ${payrollTimeShiftFont} text-center min-w-0`,
        )}
      >
        {caLamViecTrimmed ? (
          <span
            className={
              isPayroll
                ? `text-blue-600 font-bold ${payrollTimeShiftFont}`
                : "text-blue-600 font-bold text-base"
            }
          >
            {caLamViecTrimmed}
          </span>
        ) : canEdit && isPayroll ? (
          <span
            className="text-gray-500 italic text-xs"
            title={tl(
              "shiftEditOnlyViaModalHint",
              "Chưa chọn ca — mở form qua nút Sửa (cột thao tác).",
            )}
          >
            {tl("emptyUseEditButton", PAYROLL_EMPTY_CELL)}
          </span>
        ) : canEdit && !isPayroll ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "shiftEditViaModalHint",
              "Chưa chọn ca — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phân quyền")}
          </span>
        ) : (
          <span className="text-gray-400 italic">
            {isPayroll ? PAYROLL_EMPTY_CELL : "--"}
          </span>
        )}
      </Cell>
      {!isPayroll ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("offDay"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
          )}
          title={tl(
            "offDayColumnHint",
            "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
          )}
        >
          {isOffDay ? (
            <span className="tabular-nums text-rose-700 dark:text-rose-300">
              OFF
            </span>
          ) : (
            <span className="tabular-nums font-semibold text-gray-600 dark:text-slate-400">
              {ATTENDANCE_EMPTY_CELL}
            </span>
          )}
        </Cell>
      ) : null}
      {!isPayroll ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("holidayDay"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
          )}
          title={tl(
            "holidayDayColumnHint",
            "Khi ngày được đánh dấu «Ngày lễ» trên Điểm danh: hiển thị HOLIDAY.",
          )}
        >
          {isHolidayDay ? (
            <span className="tabular-nums text-amber-800 dark:text-amber-200">
              HOLIDAY
            </span>
          ) : (
            <span className="tabular-nums font-semibold text-gray-600 dark:text-slate-400">
              {ATTENDANCE_EMPTY_CELL}
            </span>
          )}
        </Cell>
      ) : null}
      {isPayroll ? (
        <>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("offDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
            )}
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            {isOffDay ? (
              <span className="tabular-nums text-rose-700 dark:text-rose-300">
                OFF
              </span>
            ) : (
              <span className="tabular-nums font-semibold text-gray-600 dark:text-slate-400">
                {PAYROLL_EMPTY_CELL}
              </span>
            )}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("holidayDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
            )}
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ» trên Điểm danh: hiển thị HOLIDAY.",
            )}
          >
            {isHolidayDay ? (
              <span className="tabular-nums text-amber-800 dark:text-amber-200">
                HOLIDAY
              </span>
            ) : (
              <span className="tabular-nums font-semibold text-gray-600 dark:text-slate-400">
                {PAYROLL_EMPTY_CELL}
              </span>
            )}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("workingHours"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-amber-50/90 dark:bg-amber-950/25",
            )}
            title={tl(
              "payrollWorkingHoursHint",
              "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
            )}
          >
            <span className="font-bold tabular-nums text-amber-900 dark:text-amber-100">
              {formatPayrollTableWorkingHoursCell(
                emp.gioVao,
                emp.gioRa,
                payrollOffLike,
                emp.caLamViec,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("overtimeHours"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-orange-50/90 dark:bg-orange-950/25",
            )}
            title={tl(
              "overtimeHoursHint",
              "Giờ ra sau 17:30: từ 17:00, cứ 30 phút = 0,5 giờ TC. Vào ≤ 06:00 (ca ngày): có thể cộng thêm 2h TC (06:00–08:00) khi xác nhận có giấy tăng ca trên màn lương.",
            )}
          >
            <span className="font-bold tabular-nums text-orange-900 dark:text-orange-100">
              {formatPayrollDayOvertimeHoursCell(
                emp.gioVao,
                emp.gioRa,
                isOffDay,
                emp.caLamViec,
                emp.payrollEarlyOtPaperwork,
                isHolidayDay,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("offDayOvertimeHours"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-violet-50/90 dark:bg-violet-950/25",
            )}
            title={tl(
              "payrollOffDayTcHint",
              "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
            )}
          >
            <span className="font-bold tabular-nums text-violet-900 dark:text-violet-100">
              {formatPayrollTableOffDayTcCell(
                emp.gioVao,
                emp.gioRa,
                isOffDay,
                emp.caLamViec,
                emp.payrollEarlyOtPaperwork,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("holidayDayWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-green-100/90 dark:bg-green-950/30",
            )}
            title={tl(
              "payrollHolidayDayWorkingHoursHint",
              "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
            )}
          >
            <span className="font-bold tabular-nums text-green-950 dark:text-green-100">
              {formatPayrollTableHolidayDayWorkingCell(
                emp.gioVao,
                emp.gioRa,
                isHolidayDay,
                emp.caLamViec,
                emp.payrollEarlyOtPaperwork,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("payrollTotalGcDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-sky-100/90 dark:bg-sky-950/30",
            )}
            title={tl(
              "payrollTotalGcDayHint",
              "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
            )}
          >
            <span className="font-bold tabular-nums text-sky-950 dark:text-sky-100">
              {formatPayrollTableTotalDayGcCell(
                emp.gioVao,
                emp.gioRa,
                isOffDay,
                isHolidayDay,
                emp.caLamViec,
                emp.payrollEarlyOtPaperwork,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-teal-50/90 dark:bg-teal-950/25",
            )}
            title={tl(
              "nightShiftWorkingHoursHint",
              "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
            )}
          >
            <span className="font-bold tabular-nums text-teal-900 dark:text-teal-100">
              {formatPayrollTableNightShiftWorkingCell(
                emp.gioVao,
                emp.gioRa,
                payrollOffLike,
                emp.caLamViec,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftOvertimeHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-fuchsia-50/90 dark:bg-fuchsia-950/25",
            )}
            title={tl(
              "nightShiftOvertimeHoursHint",
              "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
            )}
          >
            <span className="font-bold tabular-nums text-fuchsia-900 dark:text-fuchsia-100">
              {formatPayrollTableNightShiftOvertimeCell(
                emp.gioVao,
                emp.gioRa,
                payrollOffLike,
                emp.caLamViec,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftOffDayWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-emerald-50/90 dark:bg-emerald-950/25",
            )}
            title={tl(
              "nightShiftOffDayWorkingHoursHint",
              "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
            )}
          >
            <span className="font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
              {formatPayrollTableNightShiftOffDayWorkingCell(
                emp.gioVao,
                emp.gioRa,
                isOffDay,
                emp.caLamViec,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("holidayNightWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-lime-100/90 dark:bg-lime-950/35",
            )}
            title={tl(
              "payrollHolidayNightWorkingHoursHint",
              "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
            )}
          >
            <span className="font-bold tabular-nums text-lime-950 dark:text-lime-100">
              {formatPayrollTableHolidayNightWorkingCell(
                emp.gioVao,
                emp.gioRa,
                isHolidayDay,
                emp.caLamViec,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("payrollTotalGcNight"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-indigo-100/90 dark:bg-indigo-950/30",
            )}
            title={tl(
              "payrollTotalGcNightHint",
              "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
            )}
          >
            <span className="font-bold tabular-nums text-indigo-950 dark:text-indigo-100">
              {formatPayrollTableTotalNightGcCell(
                emp.gioVao,
                emp.gioRa,
                payrollOffLike,
                emp.caLamViec,
              )}
            </span>
          </Cell>
        </>
      ) : null}
      {showRowModalActions && (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("actions"))}
          className={cellCls("hidden md:table-cell px-1 text-center min-w-0")}
        >
          {canEdit ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(emp)}
                className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                title="Chỉnh sửa"
              >
                ✏️
              </button>
              {canDeleteRow ? (
                <button
                  type="button"
                  onClick={() => onDelete(emp.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                  title="Xóa"
                >
                  🗑️
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-gray-300 text-xs">
              {isPayroll ? PAYROLL_EMPTY_CELL : "—"}
            </span>
          )}
        </Cell>
      )}
    </Row>
  );
}

function propsAreEqual(prev, next) {
  if (prev.virtualRow !== next.virtualRow) {
    if (!prev.virtualRow || !next.virtualRow) return false;
    if (
      prev.virtualRow.key !== next.virtualRow.key ||
      prev.virtualRow.index !== next.virtualRow.index ||
      prev.virtualRow.start !== next.virtualRow.start ||
      prev.virtualRow.size !== next.virtualRow.size
    ) {
      return false;
    }
  }
  return (
    prev.emp === next.emp &&
    prev.idx === next.idx &&
    prev.showRowModalActions === next.showRowModalActions &&
    prev.columnPlan === next.columnPlan &&
    prev.user === next.user &&
    prev.canEdit === next.canEdit &&
    prev.tl === next.tl &&
    prev.t === next.t &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.canDeleteRow === next.canDeleteRow &&
    prev.measureElementRef === next.measureElementRef &&
    prev.gridTemplateColumns === next.gridTemplateColumns &&
    prev.isOffDay === next.isOffDay &&
    prev.isHolidayDay === next.isHolidayDay &&
    prev.tableVariant === next.tableVariant
  );
}

export default memo(AttendanceTableRow, propsAreEqual);
