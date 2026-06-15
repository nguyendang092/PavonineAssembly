/**
 * Màu nền / viền lưới bảng chấm công tháng (light) — dùng chung UI và xuất Excel.
 */
import { getAttendanceLeaveTypeEmphasisPrintCellBg } from "@/features/attendance/attendanceGioVaoTypeOptions";
import { parseLocalDateKey } from "@/utils/dateKey";
import {
  DETAIL_GROUP_KEYS,
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_STICKY_COL_COUNT,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";

export const PTS_COLORS = {
  black: "FF000000",
  stickyHeaderBg: "FFF1F5F9",
  stickyBodyEven: "FFFFFFFF",
  stickyBodyOdd: "FFF8FAFC",
  headBorder: "FF94A3B8",
  bodyBorder: "FFCBD5E1",
  daySunHeader: "FFFEF08A",
  daySunBody: "FFFEF9C3",
  daySatHeader: "FF94A3B8",
  daySatBody: "FFE2E8F0",
  dayHolidayHeader: "FF99F6E4",
  dayHolidayBody: "FFCCFBF1",
  dayCompHeader: "FFD9F99D",
  dayCompBody: "FFECFCCB",
  /** Ngày off — cùng tông vàng như chủ nhật. */
  dayOffHeader: "FFFEF08A",
  dayOffBody: "FFFEF9C3",
  dayDefaultHeader: "FFF1F5F9",
  detailTotalHeader: "FFE2E8F0",
  detailTrialHeader: "FFCFFAFE",
  detailOfficialHeader: "FFEDE9FE",
  detailTotalBody: "FFF8FAFC",
  detailTrialBody: "FFECFEFF",
  detailOfficialBody: "FFF5F3FF",
  /** Dòng đầu / NV (hệ số TC trống — giờ thường + phép) — xuất Excel. */
  mainSubrowHighlightBg: "FFFED7AA",
};

export function hexToExcelArgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length === 6) return `FF${h.toUpperCase()}`;
  return h.length === 8 ? h.toUpperCase() : "FFFFFFFF";
}

/** Nền header cột ngày — khớp `monthTimesheetDayHeaderClass`. */
export function getPayrollMonthlyTimesheetDayHeaderBg(pd, ch) {
  if (pd?.getDay() === 0) return PTS_COLORS.daySunHeader;
  if (ch?.isHolidayDay) return PTS_COLORS.dayHolidayHeader;
  if (ch?.isCompensatoryDay) return PTS_COLORS.dayCompHeader;
  if (ch?.isOffDay) return PTS_COLORS.dayOffHeader;
  if (pd?.getDay() === 6) return PTS_COLORS.daySatHeader;
  return PTS_COLORS.dayDefaultHeader;
}

/** Nền ô ngày body; `null` = dùng nền dải NV. */
export function getPayrollMonthlyTimesheetDayBodyBg(pd, ch) {
  if (pd?.getDay() === 0) return PTS_COLORS.daySunBody;
  if (ch?.isHolidayDay) return PTS_COLORS.dayHolidayBody;
  if (ch?.isCompensatoryDay) return PTS_COLORS.dayCompBody;
  if (ch?.isOffDay) return PTS_COLORS.dayOffBody;
  if (pd?.getDay() === 6) return PTS_COLORS.daySatBody;
  return null;
}

export function getPayrollMonthlyTimesheetDetailGroupHeaderBg(groupKey) {
  if (groupKey === "total") return PTS_COLORS.detailTotalHeader;
  if (groupKey === "trial") return PTS_COLORS.detailTrialHeader;
  return PTS_COLORS.detailOfficialHeader;
}

export function getPayrollMonthlyTimesheetDetailGroupBodyBg(groupIndex) {
  if (groupIndex === 0) return PTS_COLORS.detailTotalBody;
  if (groupIndex === 1) return PTS_COLORS.detailTrialBody;
  return PTS_COLORS.detailOfficialBody;
}

export function getPayrollMonthlyTimesheetEmployeeStripeBg(empBlockIdx) {
  return empBlockIdx % 2 === 0
    ? PTS_COLORS.stickyBodyEven
    : PTS_COLORS.stickyBodyOdd;
}

/** Tailwind class tương đương (lưới UI). */
export function payrollMonthlyTimesheetDayHeaderBgClass(pd, ch) {
  const argb = getPayrollMonthlyTimesheetDayHeaderBg(pd, ch);
  const map = {
    [PTS_COLORS.daySunHeader]: "bg-yellow-200 dark:bg-slate-700/55",
    [PTS_COLORS.daySatHeader]: "bg-slate-400 dark:bg-slate-600",
    [PTS_COLORS.dayHolidayHeader]: "bg-teal-200 dark:bg-rose-900/40",
    [PTS_COLORS.dayCompHeader]: "bg-lime-200 dark:bg-teal-900/40",
    [PTS_COLORS.dayOffHeader]: "bg-yellow-200 dark:bg-slate-700/55",
    [PTS_COLORS.dayDefaultHeader]: "bg-slate-100 dark:bg-slate-800",
  };
  return map[argb] || "bg-slate-100 dark:bg-slate-800";
}

export function payrollMonthlyTimesheetDayBodyBgClass(pd, ch) {
  const argb = getPayrollMonthlyTimesheetDayBodyBg(pd, ch);
  if (!argb) return "";
  const map = {
    [PTS_COLORS.daySunBody]: "bg-yellow-100 dark:bg-slate-800/55",
    [PTS_COLORS.daySatBody]: "bg-slate-200 dark:bg-slate-700",
    [PTS_COLORS.dayHolidayBody]: "bg-teal-100 dark:bg-amber-950/25",
    [PTS_COLORS.dayCompBody]: "bg-lime-100 dark:bg-teal-950/25",
    [PTS_COLORS.dayOffBody]: "bg-yellow-100 dark:bg-slate-800/55",
  };
  return map[argb] || "";
}

export function payrollMonthlyTimesheetDetailGroupHeaderClass(groupKey) {
  if (groupKey === "total") return "bg-slate-200 dark:bg-slate-700";
  if (groupKey === "trial") return "bg-cyan-100 dark:bg-cyan-900";
  return "bg-violet-100 dark:bg-violet-900";
}

export function payrollMonthlyTimesheetDetailGroupBodyClass(groupIndex) {
  if (groupIndex === 0) return "bg-slate-50 dark:bg-slate-900";
  if (groupIndex === 1) return "bg-cyan-50/60 dark:bg-cyan-950/20";
  return "bg-violet-50/60 dark:bg-violet-950/20";
}

function borderSide(style, argb) {
  return { style, color: { argb } };
}

export function buildPayrollMonthlyTimesheetExcelBorders({
  row1Based: r,
  col1Based: c,
  maxRow,
  maxCol,
  layout,
  headerRowCount = 3,
  subrowCount,
  subrowIndex,
  monthKeyCount,
  empBlockIdx = 0,
}) {
  const isHeader = r <= headerRowCount;
  const thinColor = isHeader ? PTS_COLORS.headBorder : PTS_COLORS.bodyBorder;
  const thin = (style = "thin") => borderSide(style, thinColor);
  const strong = () => borderSide("medium", PTS_COLORS.black);
  const dashedSticky = () => borderSide("mediumDashed", PTS_COLORS.headBorder);

  const L = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const daysEnd = L + monthKeyCount;
  const isSticky = c <= L;
  const stickyIdx = c - 1;
  const isDetailCol = c > daysEnd;

  const detailGroupStarts = [
    layout.totalDetailStart + 1,
    layout.trialDetailStart + 1,
    layout.officialDetailStart + 1,
  ];
  const isDetailGroupStart = detailGroupStarts.includes(c);
  const col0InBlock =
    isDetailCol &&
    (c - 1 - layout.totalDetailStart) % MONTH_DETAIL_COLS_PER_BLOCK === 0;

  const isLastSubrow =
    r > headerRowCount &&
    subrowIndex != null &&
    subrowIndex === subrowCount - 1;
  const isMainSubrow =
    r > headerRowCount && subrowIndex === 0;

  const border = {
    top: thin(),
    left: thin(),
    bottom: thin(),
    right: thin(),
  };

  if (r === 1) border.top = strong();
  if (r === maxRow) border.bottom = strong();
  if (c === 1) border.left = strong();
  if (c === maxCol) border.right = strong();

  if (isSticky && stickyIdx >= 0 && stickyIdx < L - 1) {
    border.right = dashedSticky();
  }
  if (c === L) border.right = strong();

  if (isDetailGroupStart || col0InBlock) border.left = strong();
  if (isLastSubrow) border.bottom = strong();
  if (isMainSubrow && empBlockIdx > 0) border.top = strong();

  return border;
}

export function resolvePayrollMonthlyTimesheetExcelCellFill({
  r,
  c,
  layout,
  headerRowCount,
  monthKeys,
  chunkByDate,
  empBlockIdx,
  subrowIndex,
  leaveRaw,
  isLeaveCell,
}) {
  const L = MONTHLY_TIMESHEET_STICKY_COL_COUNT;
  const daysEnd = L + monthKeys.length;

  if (r <= headerRowCount) {
    if (c <= L) return PTS_COLORS.stickyHeaderBg;

    if (c > L && c <= daysEnd) {
      const dk = monthKeys[c - L - 1];
      const pd = parseLocalDateKey(dk);
      const ch = chunkByDate.get(dk);
      return getPayrollMonthlyTimesheetDayHeaderBg(pd, ch);
    }

    if (c > daysEnd) {
      const rel = c - 1 - layout.totalDetailStart;
      const block = Math.floor(rel / MONTH_DETAIL_COLS_PER_BLOCK);
      return getPayrollMonthlyTimesheetDetailGroupHeaderBg(
        DETAIL_GROUP_KEYS[block],
      );
    }
    return PTS_COLORS.stickyHeaderBg;
  }

  const isMainSubrow = subrowIndex === 0;
  if (isMainSubrow) {
    if (isLeaveCell && c > L && c <= daysEnd) {
      return hexToExcelArgb(
        getAttendanceLeaveTypeEmphasisPrintCellBg(leaveRaw),
      );
    }
    return PTS_COLORS.mainSubrowHighlightBg;
  }

  const stripe = getPayrollMonthlyTimesheetEmployeeStripeBg(empBlockIdx);

  if (c <= L) return stripe;

  if (c > L && c <= daysEnd) {
    if (isLeaveCell) {
      return hexToExcelArgb(
        getAttendanceLeaveTypeEmphasisPrintCellBg(leaveRaw),
      );
    }
    const dk = monthKeys[c - L - 1];
    const pd = parseLocalDateKey(dk);
    const ch = chunkByDate.get(dk);
    const dayBg = getPayrollMonthlyTimesheetDayBodyBg(pd, ch);
    return dayBg || stripe;
  }

  const rel = c - 1 - layout.totalDetailStart;
  const groupIndex = Math.floor(rel / MONTH_DETAIL_COLS_PER_BLOCK);
  return getPayrollMonthlyTimesheetDetailGroupBodyBg(groupIndex);
}
