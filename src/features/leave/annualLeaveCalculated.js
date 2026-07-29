import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

export function parseAnnualLeaveNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const t = String(value).trim();
  if (!t || t === "-") return 0;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function roundAnnualLeaveHours(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100 + 1e-9) / 100;
}

function parseAnnualLeaveIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ngày chốt thâm niên cho phép năm của `year` (năm hiện tại → hôm nay). */
export function resolveAnnualLeaveTenureAsOfDateKey(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yearEnd = `${y}-12-31`;

  if (todayKey.startsWith(`${y}-`)) return todayKey;
  if (y < today.getFullYear()) return yearEnd;
  return yearEnd;
}

/** Số năm làm việc tròn (đã qua ngày kỷ niệm vào làm). */
export function completedYearsFromStartWorkingDate(
  startWorkingDate,
  asOfDateKey,
) {
  const join = parseAnnualLeaveIsoDate(startWorkingDate);
  const asOf = parseAnnualLeaveIsoDate(asOfDateKey);
  if (!join || !asOf) return null;
  if (asOf.getTime() < join.getTime()) return 0;

  let years = asOf.getFullYear() - join.getFullYear();
  const monthDiff = asOf.getMonth() - join.getMonth();
  const dayDiff = asOf.getDate() - join.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** Phép cộng thêm theo thâm niên: ≥5 năm +1, ≥10 năm +2. */
export function annualLeaveTenureBonusDays(completedYears) {
  if (completedYears == null || !Number.isFinite(completedYears)) return 0;
  if (completedYears >= 10) return 2;
  if (completedYears >= 5) return 1;
  return 0;
}

export function resolveAnnualLeaveTenureBonus(startWorkingDate, year) {
  const asOf = resolveAnnualLeaveTenureAsOfDateKey(year);
  if (!asOf) return 0;
  const completed = completedYearsFromStartWorkingDate(startWorkingDate, asOf);
  return annualLeaveTenureBonusDays(completed);
}

/** Ngày chốt tính phép trong năm `year` (năm hiện tại → hôm nay, năm trước → 31/12). */
export function resolveAnnualLeaveYearAsOfDateKey(year) {
  return resolveAnnualLeaveTenureAsOfDateKey(year);
}

/** Số tháng làm việc trong năm (mỗi tháng +1 phép) — reset theo năm lịch. */
export function isStartWorkingDateInCalendarMonth(
  startWorkingDate,
  year,
  monthIndex,
) {
  const join = parseAnnualLeaveIsoDate(startWorkingDate);
  const y = Number(year);
  const m = Number(monthIndex);
  if (!join || !Number.isFinite(y) || !Number.isFinite(m)) return false;
  return join.getFullYear() === y && join.getMonth() === m;
}

/**
 * Tháng vào làm: đủ điều kiện +1 phép khi ngày công thực tế ≥ ½ ngày công chuẩn (giờ công).
 * @param {{ workDays?: number, standardWorkDays?: number } | null | undefined} summary
 */
export function monthMeetsHalfStandardWorkDays(summary) {
  if (!summary || typeof summary !== "object") return false;
  const standard = Number(summary.standardWorkDays);
  const work = Number(summary.workDays);
  if (!Number.isFinite(standard) || standard <= 0) return false;
  if (!Number.isFinite(work) || work < 0) return false;
  return work >= standard / 2;
}

/**
 * Số tháng làm việc trong năm (mỗi tháng +1 phép).
 * Tháng có START WORKING DATE trong năm: +1 chỉ khi đủ ½ ngày công chuẩn (từ giờ công).
 */
export function resolveAnnualLeaveMonthlyAccrualDays(
  startWorkingDate,
  year,
  joinMonthWorkSummary = null,
) {
  const asOf = resolveAnnualLeaveYearAsOfDateKey(year);
  const y = Number(year);
  if (!asOf || !Number.isFinite(y)) return 0;

  const join = parseAnnualLeaveIsoDate(startWorkingDate);
  const asOfDate = parseAnnualLeaveIsoDate(asOf);
  if (!join || !asOfDate) return 0;
  if (asOfDate.getTime() < join.getTime()) return 0;

  const yearStart = parseAnnualLeaveIsoDate(`${y}-01-01`);
  const periodStart =
    join.getTime() > yearStart.getTime() ? join : yearStart;

  if (periodStart.getFullYear() > y || asOfDate.getFullYear() < y) return 0;

  const startMonth =
    periodStart.getFullYear() < y ? 0 : periodStart.getMonth();
  const endMonth = asOfDate.getFullYear() > y ? 11 : asOfDate.getMonth();

  if (endMonth < startMonth) return 0;

  let accrual = 0;
  for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex += 1) {
    if (isStartWorkingDateInCalendarMonth(startWorkingDate, y, monthIndex)) {
      if (monthMeetsHalfStandardWorkDays(joinMonthWorkSummary)) {
        accrual += 1;
      }
    } else {
      accrual += 1;
    }
  }
  return accrual;
}

/** Phép năm hiện tại = tháng trong năm (+1/tháng) + thưởng thâm niên. */
export function resolveAnnualLeaveCurrentYear(
  row,
  year,
  { joinMonthWorkSummary = null } = {},
) {
  const startDate = row?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
  if (!startDate) {
    return parseAnnualLeaveNumber(
      row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
    );
  }

  const monthlyAccrual = resolveAnnualLeaveMonthlyAccrualDays(
    startDate,
    year,
    joinMonthWorkSummary,
  );
  const tenureBonus = resolveAnnualLeaveTenureBonus(startDate, year);
  return roundAnnualLeaveHours(monthlyAccrual + tenureBonus);
}

/** Tổng phép & tồn — luôn tính lại khi import / hiển thị. */
export function computeAnnualLeaveTotals(
  row,
  year = null,
  { joinMonthWorkSummary = null } = {},
) {
  const annual =
    year != null
      ? resolveAnnualLeaveCurrentYear(row, year, { joinMonthWorkSummary })
      : parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]);
  const bonus = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV],
  );
  const comp = parseAnnualLeaveNumber(
    row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF],
  );
  const hasSplitUsed =
    row[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] != null ||
    row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED] != null;
  const used = hasSplitUsed
    ? roundAnnualLeaveHours(
        parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]) +
          parseAnnualLeaveNumber(
            row[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
          ),
      )
    : parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]);
  const total = roundAnnualLeaveHours(annual + bonus + comp);
  const balance = roundAnnualLeaveHours(total - used);
  return {
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: total,
    [ANNUAL_LEAVE_EMP.BALANCE]: balance,
  };
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Các tháng lịch `yyyy-mm` (01→12) của năm. */
export function listAnnualLeaveCalendarYearMonths(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return [];
  return Array.from({ length: 12 }, (_, i) =>
    `${y}-${String(i + 1).padStart(2, "0")}`,
  );
}

/** `2026-01` → `Jan-26` (header cột bảng phép năm). */
export function formatAnnualLeaveMonthColumnLabel(yearMonth) {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(String(yearMonth))) {
    return yearMonth ?? "";
  }
  const mon = Number(String(yearMonth).slice(5, 7));
  const yy = String(yearMonth).slice(2, 4);
  const label = MONTH_LABELS[mon - 1] ?? String(yearMonth).slice(5, 7);
  return `${label}-${yy}`;
}

/** ISO `yyyy-mm-dd` → hiển thị như Excel (vd. 20-Aug-88). */
export function formatAnnualLeaveDisplayDate(iso, { fullYear = false } = {}) {
  if (!iso || typeof iso !== "string") return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mon || !d) return iso;
  const label = MONTH_LABELS[mon - 1] ?? m[2];
  const yy = fullYear ? String(y) : String(y).slice(-2).padStart(2, "0");
  return `${d}-${label}-${yy}`;
}

export function formatAnnualLeaveDecimal(value) {
  const n = roundAnnualLeaveHours(value);
  return n.toFixed(2);
}
