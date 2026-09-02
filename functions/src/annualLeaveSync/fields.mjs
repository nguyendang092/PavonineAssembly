/** RTDB field names — mirror `src/features/leave/annualLeaveFields.js`. */
export const ANNUAL_LEAVE_RTDB_ROOT = "annualLeave";
export const ANNUAL_LEAVE_META_KEY = "_meta";
export const ATTENDANCE_LEAVE_AGG_ROOT = "attendanceLeaveAgg";

export const ANNUAL_LEAVE_EMP = {
  START_WORKING_DATE: "startWorkingDate",
  MNV_PREFIX: "mnvPrefix",
  ANNUAL_LEAVE_CURRENT_YEAR: "annualLeaveCurrentYear",
  ANNUAL_LEAVE_ADJUSTMENT: "annualLeaveAdjustment",
  BONUS_ANNUAL_LEAVE_ENV: "bonusAnnualLeaveEnv",
  COMPENSATORY_DAY_OFF: "compensatoryDayOff",
  TOTAL_ANNUAL_LEAVE: "totalAnnualLeave",
  ANNUAL_LEAVE_USED: "annualLeaveUsed",
  HR_ANNUAL_LEAVE_USED: "hrAnnualLeaveUsed",
  ATTENDANCE_ANNUAL_LEAVE_USED: "attendanceAnnualLeaveUsed",
  BALANCE: "balance",
  MONTHLY_LEAVE_USAGE: "monthlyLeaveUsage",
};

export const ATTENDANCE_LEAVE_AGG_EMP = {
  DEDUCTION_BY_MONTH: "deductionByMonth",
  USAGE_DETAIL: "usageDetail",
  LAST_UPDATED: "lastUpdated",
  UPDATED_BY: "updatedBy",
};

function nextYearMonth(yearMonth) {
  const y = Number(yearMonth.slice(0, 4));
  const m = Number(yearMonth.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  if (m >= 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Các tháng trước kỳ tính phép (mới → cũ), vd. 2026: 05…01. */
export function listAnnualLeavePreCountDisplayMonthKeys(year) {
  const start = annualLeaveAttendanceCountStartDate(year);
  const y = Number(year);
  if (!start || !Number.isFinite(y)) return [];

  const startYearMonth = start.slice(0, 7);
  const months = [];
  let cursor = `${y}-01`;

  while (cursor < startYearMonth) {
    months.push(cursor);
    cursor = nextYearMonth(cursor);
  }

  return months.reverse();
}

/** Các tháng `yyyy-mm` từ ngày bắt đầu tính đến cuối năm. */
export function listAnnualLeaveCountYearMonths(year) {
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return [];

  const y = Number(year);
  if (!Number.isFinite(y)) return [];

  const startYearMonth = start.slice(0, 7);
  const endYearMonth = `${y}-12`;
  if (endYearMonth < startYearMonth) return [];

  const months = [];
  let cursor = startYearMonth;

  while (cursor <= endYearMonth) {
    months.push(cursor);
    cursor = nextYearMonth(cursor);
  }

  return months;
}

export function listAnnualLeaveDetailHistoryMonths(year) {
  return listAnnualLeaveCountYearMonths(year).slice().reverse();
}

/** 2026: PN từ điểm danh tính từ 01/06. */
export const ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR = {
  2026: "2026-06-01",
};

export function annualLeaveAttendanceCountStartDate(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  if (ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR[y]) {
    return ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR[y];
  }
  if (y > 2026) return `${y}-01-01`;
  return null;
}

export function isAttendanceDateCountedForAnnualLeave(dateKey, year) {
  if (!dateKey || typeof dateKey !== "string") return false;
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return false;
  const y = Number(year);
  if (!Number.isFinite(y) || !dateKey.startsWith(`${y}-`)) return false;
  return dateKey >= start;
}

export function isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year) {
  if (!dateKey || typeof dateKey !== "string") return false;
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return false;
  const y = Number(year);
  if (!Number.isFinite(y) || !dateKey.startsWith(`${y}-`)) return false;
  return dateKey < start;
}
