/** RTDB: `annualLeave/{year}/{empKey}` */
export const ANNUAL_LEAVE_RTDB_ROOT = "annualLeave";

export const ANNUAL_LEAVE_EMP = {
  MNV_PREFIX: "mnvPrefix",
  MNV_SUFFIX: "mnvSuffix",
  FULL_NAME: "fullName",
  DATE_OF_BIRTH: "dateOfBirth",
  SUB_DEPARTMENT: "subDepartment",
  START_WORKING_DATE: "startWorkingDate",
  ANNUAL_LEAVE_CURRENT_YEAR: "annualLeaveCurrentYear",
  BONUS_ANNUAL_LEAVE_ENV: "bonusAnnualLeaveEnv",
  COMPENSATORY_DAY_OFF: "compensatoryDayOff",
  TOTAL_ANNUAL_LEAVE: "totalAnnualLeave",
  ANNUAL_LEAVE_USED: "annualLeaveUsed",
  /** Phép đã dùng từ Excel HR — không gộp điểm danh. */
  HR_ANNUAL_LEAVE_USED: "hrAnnualLeaveUsed",
  /** Phép đã dùng tính từ điểm danh (PN/1/2PN) cả năm. */
  ATTENDANCE_ANNUAL_LEAVE_USED: "attendanceAnnualLeaveUsed",
  BALANCE: "balance",
};

export const ANNUAL_LEAVE_META_KEY = "_meta";

/**
 * Ngày bắt đầu tính PN/1/2PN từ điểm danh — theo năm.
 * 2026: từ 01/06 (tháng trước là thử nghiệm). Các năm sau: từ 01/01.
 */
export const ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR = {
  2026: "2026-06-01",
};

/** Năm nhỏ nhất trong dropdown quản lý phép năm. */
export const ANNUAL_LEAVE_MANAGER_MIN_YEAR = 2026;

/** ISO `yyyy-mm-dd` — ngày đầu tiên được trừ phép từ điểm danh trong năm. */
export function annualLeaveAttendanceCountStartDate(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  if (ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR[y]) {
    return ANNUAL_LEAVE_ATTENDANCE_COUNT_START_BY_YEAR[y];
  }
  if (y > 2026) return `${y}-01-01`;
  return null;
}

/** Điểm danh trước ngày bắt đầu (vd. thử nghiệm) — không trừ phép năm. */
export function isAttendanceDateCountedForAnnualLeave(dateKey, year) {
  if (!dateKey || typeof dateKey !== "string") return false;
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return false;
  const y = Number(year);
  if (!Number.isFinite(y) || !dateKey.startsWith(`${y}-`)) return false;
  return dateKey >= start;
}

/** Trước ngày bắt đầu tính (vd. thử nghiệm) — chỉ hiển thị trong chi tiết, không trừ phép. */
export function isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year) {
  if (!dateKey || typeof dateKey !== "string") return false;
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return false;
  const y = Number(year);
  if (!Number.isFinite(y) || !dateKey.startsWith(`${y}-`)) return false;
  return dateKey < start;
}

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

/** Các tháng `yyyy-mm` từ ngày bắt đầu tính đến `throughDateKey` hoặc cuối năm. */
export function listAnnualLeaveCountYearMonths(year, throughDateKey = null) {
  const start = annualLeaveAttendanceCountStartDate(year);
  if (!start) return [];

  const y = Number(year);
  if (!Number.isFinite(y)) return [];

  const yearPrefix = `${y}-`;
  const startYearMonth = start.slice(0, 7);
  let endYearMonth = `${y}-12`;

  if (
    throughDateKey &&
    String(throughDateKey).startsWith(yearPrefix) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
  ) {
    endYearMonth = String(throughDateKey).slice(0, 7);
  }

  if (endYearMonth < startYearMonth) return [];

  const months = [];
  let cursor = startYearMonth;

  while (cursor <= endYearMonth) {
    months.push(cursor);
    const monthNum = Number(cursor.slice(5, 7));
    const yearNum = Number(cursor.slice(0, 4));
    if (monthNum >= 12) {
      cursor = `${yearNum + 1}-01`;
    } else {
      cursor = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}`;
    }
  }

  return months;
}

/** ISO `yyyy-mm-dd` — mặc định cho chi tiết theo tháng khi không có `throughDateKey`. */
export function resolveAnnualLeaveDetailThroughDateKey(year, throughDateKey = null) {
  const y = Number(year);
  const today = new Date().toISOString().slice(0, 10);
  const todayYear = Number(today.slice(0, 4));

  if (
    throughDateKey &&
    String(throughDateKey).startsWith(`${y}-`) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
  ) {
    return String(throughDateKey);
  }

  if (!Number.isFinite(y)) return today;
  if (today.startsWith(`${y}-`)) return today;
  if (y < todayYear) return `${y}-12-31`;
  if (y > todayYear) return `${y}-01-01`;
  return today;
}

function previousYearMonth(yearMonth) {
  const y = Number(yearMonth.slice(0, 4));
  const m = Number(yearMonth.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Toàn bộ tháng lịch sử phép (mới → cũ) từ ngày bắt đầu tính đến `through`.
 */
export function listAnnualLeaveDetailHistoryMonths(year, throughDateKey = null) {
  return listAnnualLeaveCountYearMonths(year, throughDateKey).slice().reverse();
}

/** Ba tháng gần nhất trong modal chi tiết (mặc định trước khi mở rộng). */
export function listAnnualLeaveDetailRecentMonths(
  year,
  throughDateKey = null,
  limit = 3,
) {
  return listAnnualLeaveDetailHistoryMonths(year, throughDateKey).slice(0, limit);
}

/**
 * @deprecated Dùng `listAnnualLeaveDetailRecentMonths` — giữ tương thích test cũ.
 */
export function listAnnualLeaveDetailDisplayMonths(year, throughDateKey = null) {
  return listAnnualLeaveDetailRecentMonths(year, throughDateKey, 2);
}
