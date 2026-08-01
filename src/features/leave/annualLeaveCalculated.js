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

/** Điều chỉnh thủ công phép năm hiện tại — HR/Admin (+1 / -1 …). */
export function parseAnnualLeaveAdjustment(value) {
  return roundAnnualLeaveHours(parseAnnualLeaveNumber(value));
}

export function resolveAnnualLeaveAdjustment(row) {
  return parseAnnualLeaveAdjustment(row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]);
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
  if (y < today.getFullYear()) return `${y + 1}-01-01`;
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

/** Phép cộng thêm theo thâm niên: mỗi trọn 5 năm +1 (5→+1, 10→+2, 15→+3, …). */
export function annualLeaveTenureBonusDays(completedYears) {
  if (completedYears == null || !Number.isFinite(completedYears)) return 0;
  if (completedYears >= 5) return Math.floor(completedYears / 5);
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

/** NV có ngày vào làm thuộc năm lịch `year`. */
export function isStartWorkingDateInCalendarYear(startWorkingDate, year) {
  const join = parseAnnualLeaveIsoDate(startWorkingDate);
  const y = Number(year);
  if (!join || !Number.isFinite(y)) return false;
  return join.getFullYear() === y;
}

/**
 * Tháng vào làm (NV vào làm trong năm hiện tại): +1 phép khi (từ lưới tháng giờ công, khối TỔNG)
 * «Tổng ngày công (gồm ngày nghỉ có lương)» ≥ ½ «Ngày thực tế làm việc».
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

/** Khoảng tháng 0-based (Jan=0) tính +1 phép trong năm `year`. */
export function resolveAnnualLeaveAccrualMonthRange(
  startWorkingDate,
  year,
  asOfDateKey = null,
) {
  const asOf = asOfDateKey ?? resolveAnnualLeaveYearAsOfDateKey(year);
  const y = Number(year);
  if (!asOf || !Number.isFinite(y)) return null;

  const join = parseAnnualLeaveIsoDate(startWorkingDate);
  const asOfDate = parseAnnualLeaveIsoDate(asOf);
  if (!join || !asOfDate) return null;
  if (asOfDate.getTime() < join.getTime()) return null;

  const yearStart = parseAnnualLeaveIsoDate(`${y}-01-01`);
  const periodStart =
    join.getTime() > yearStart.getTime() ? join : yearStart;

  if (periodStart.getFullYear() > y || asOfDate.getFullYear() < y) return null;

  const startMonth =
    periodStart.getFullYear() < y ? 0 : periodStart.getMonth();
  const endMonth = asOfDate.getFullYear() > y ? 11 : asOfDate.getMonth();

  if (endMonth < startMonth) return null;
  return { startMonth, endMonth };
}

function resolveMonthWorkSummaryForAccrual(
  monthWorkSummaryByYearMonth,
  year,
  monthIndex,
) {
  if (!monthWorkSummaryByYearMonth || typeof monthWorkSummaryByYearMonth !== "object") {
    return null;
  }
  const yearMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return monthWorkSummaryByYearMonth[yearMonth] ?? null;
}

/**
 * Số tháng +1 phép trong năm.
 * - NV vào làm trước năm `year`: +1/tháng trong kỳ (kể cả tháng hiện tại).
 * - NV vào làm trong năm `year`:
 *   • Chỉ tháng có ngày vào làm: kiểm ≥ ½ «Ngày thực tế làm việc» (vào giữa/cuối/đầu tháng).
 *   • Mọi tháng sau tháng vào làm: +1 mặc định như NV năm cũ (kể cả tháng hiện tại).
 * @param {Record<string, { workDays?: number, standardWorkDays?: number }> | null | undefined} monthWorkSummaryByYearMonth
 */
export function resolveAnnualLeaveMonthlyAccrualDays(
  startWorkingDate,
  year,
  monthWorkSummaryByYearMonth = null,
) {
  const range = resolveAnnualLeaveAccrualMonthRange(startWorkingDate, year);
  if (!range) return 0;

  const y = Number(year);
  const requiresPayrollHalfDayCheck = isStartWorkingDateInCalendarYear(
    startWorkingDate,
    y,
  );
  let accrual = 0;
  for (
    let monthIndex = range.startMonth;
    monthIndex <= range.endMonth;
    monthIndex += 1
  ) {
    if (requiresPayrollHalfDayCheck) {
      const isJoinMonth = isStartWorkingDateInCalendarMonth(
        startWorkingDate,
        y,
        monthIndex,
      );

      if (!isJoinMonth) {
        accrual += 1;
        continue;
      }

      const summary = resolveMonthWorkSummaryForAccrual(
        monthWorkSummaryByYearMonth,
        y,
        monthIndex,
      );
      if (monthMeetsHalfStandardWorkDays(summary)) {
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
  { monthWorkSummaryByYearMonth = null } = {},
) {
  const adjustment = resolveAnnualLeaveAdjustment(row);
  const startDate = row?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
  if (!startDate) {
    return roundAnnualLeaveHours(
      parseAnnualLeaveNumber(row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]) +
        adjustment,
    );
  }

  const monthlyAccrual = resolveAnnualLeaveMonthlyAccrualDays(
    startDate,
    year,
    monthWorkSummaryByYearMonth,
  );
  const tenureBonus = resolveAnnualLeaveTenureBonus(startDate, year);
  return roundAnnualLeaveHours(monthlyAccrual + tenureBonus + adjustment);
}

/** Tổng phép & tồn — luôn tính lại khi import / hiển thị. */
export function computeAnnualLeaveTotals(
  row,
  year = null,
  { monthWorkSummaryByYearMonth = null } = {},
) {
  const annual =
    year != null
      ? resolveAnnualLeaveCurrentYear(row, year, { monthWorkSummaryByYearMonth })
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

const monthColumnLabelCache = new Map();

/** Header cột tháng bảng phép năm — cache theo năm. */
export function listAnnualLeaveManagerMonthColumnLabels(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return [];
  if (!monthColumnLabelCache.has(y)) {
    monthColumnLabelCache.set(
      y,
      listAnnualLeaveCalendarYearMonths(y).map(formatAnnualLeaveMonthColumnLabel),
    );
  }
  return monthColumnLabelCache.get(y);
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
