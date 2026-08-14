import {
  ANNUAL_LEAVE_EMP,
  annualLeaveMonthUsesPayrollHalfAccrualRule,
} from "./annualLeaveFields";

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
  return parseAnnualLeaveAdjustment(
    row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT],
  );
}

function parseAnnualLeaveIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const ANNUAL_LEAVE_MONTH_NAME_TO_INDEX = Object.freeze({
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
});

/** Chuẩn hóa ngày vào làm từ ISO, Excel text (18-Jun-2026), hoặc dd/mm/yyyy. */
export function normalizeAnnualLeaveStartWorkingDate(value) {
  const iso = parseAnnualLeaveIsoDate(value);
  if (iso) {
    const y = iso.getFullYear();
    const m = String(iso.getMonth() + 1).padStart(2, "0");
    const d = String(iso.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  const slash = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slash) {
    const day = String(slash[1]).padStart(2, "0");
    const month = String(slash[2]).padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }

  const dmyText = text.match(/^(\d{1,2})[-\s]?([a-zA-Z]{3})[-\s]?(\d{2,4})$/i);
  if (dmyText) {
    const monthIndex = ANNUAL_LEAVE_MONTH_NAME_TO_INDEX[dmyText[2].toLowerCase()];
    if (monthIndex) {
      let y = Number(dmyText[3]);
      if (dmyText[3].length === 2) {
        y = y <= 50 ? 2000 + y : 1900 + y;
      }
      const day = String(Number(dmyText[1])).padStart(2, "0");
      const month = String(monthIndex).padStart(2, "0");
      return `${y}-${month}-${day}`;
    }
  }

  return "";
}

function parseAnnualLeaveStartWorkingDate(value) {
  const normalized = normalizeAnnualLeaveStartWorkingDate(value);
  return parseAnnualLeaveIsoDate(normalized);
}

/** Tháng đã chốt (hết tháng hoặc asOf sau ngày cuối tháng) mới được +1 phép. */
export function isAnnualLeaveAccrualMonthClosed(year, monthIndex, asOfDateKey) {
  const y = Number(year);
  const m = Number(monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return true;

  const asOf =
    parseAnnualLeaveIsoDate(asOfDateKey) ??
    parseAnnualLeaveIsoDate(resolveAnnualLeaveYearAsOfDateKey(y));
  if (!asOf) return true;

  if (asOf.getFullYear() < y) return true;
  if (asOf.getFullYear() > y) return false;

  const monthEndDay = new Date(y, m + 1, 0).getDate();
  const monthEndKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(monthEndDay).padStart(2, "0")}`;
  const asOfKey = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}-${String(asOf.getDate()).padStart(2, "0")}`;
  return asOfKey >= monthEndKey;
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
  const join = parseAnnualLeaveStartWorkingDate(startWorkingDate);
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

export function resolveAnnualLeaveTenureBonus(
  startWorkingDate,
  year,
  asOfDateKey = null,
) {
  const asOf = asOfDateKey ?? resolveAnnualLeaveTenureAsOfDateKey(year);
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
  const join = parseAnnualLeaveStartWorkingDate(startWorkingDate);
  const y = Number(year);
  const m = Number(monthIndex);
  if (!join || !Number.isFinite(y) || !Number.isFinite(m)) return false;
  return join.getFullYear() === y && join.getMonth() === m;
}

/** NV có ngày vào làm thuộc năm lịch `year`. */
export function isStartWorkingDateInCalendarYear(startWorkingDate, year) {
  const join = parseAnnualLeaveStartWorkingDate(startWorkingDate);
  const y = Number(year);
  if (!join || !Number.isFinite(y)) return false;
  return join.getFullYear() === y;
}

/**
 * +1 phép/tháng khi:
 * - «Tổng ngày công (gồm ngày nghỉ có lương)» ≥ ½ «Ngày thực tế làm việc», hoặc
 * - «Số ngày nghỉ thai sản» ≥ ½ «Ngày thực tế làm việc».
 * @param {{ workDays?: number, standardWorkDays?: number, tsDays?: number } | null | undefined} summary
 */
export function monthMeetsHalfStandardWorkDays(summary) {
  if (!summary || typeof summary !== "object") return false;
  const standard = Number(summary.standardWorkDays);
  if (!Number.isFinite(standard) || standard <= 0) return false;

  const halfStandard = standard / 2;
  const tsDays = Number(summary.tsDays);
  if (Number.isFinite(tsDays) && tsDays >= 0 && tsDays >= halfStandard) {
    return true;
  }

  const work = Number(summary.workDays);
  if (!Number.isFinite(work) || work < 0) return false;
  return work >= halfStandard;
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

  const join = parseAnnualLeaveStartWorkingDate(startWorkingDate);
  const asOfDate = parseAnnualLeaveIsoDate(asOf);
  if (!join || !asOfDate) return null;
  if (asOfDate.getTime() < join.getTime()) return null;

  const yearStart = parseAnnualLeaveIsoDate(`${y}-01-01`);
  const periodStart = join.getTime() > yearStart.getTime() ? join : yearStart;

  if (periodStart.getFullYear() > y || asOfDate.getFullYear() < y) return null;

  const startMonth = periodStart.getFullYear() < y ? 0 : periodStart.getMonth();
  const endMonth = asOfDate.getFullYear() > y ? 11 : asOfDate.getMonth();

  if (endMonth < startMonth) return null;
  return { startMonth, endMonth };
}

function resolveMonthWorkSummaryForAccrual(
  monthWorkSummaryByYearMonth,
  year,
  monthIndex,
) {
  if (
    !monthWorkSummaryByYearMonth ||
    typeof monthWorkSummaryByYearMonth !== "object"
  ) {
    return null;
  }
  const yearMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return monthWorkSummaryByYearMonth[yearMonth] ?? null;
}

/**
 * Số tháng +1 phép trong năm.
 * - Từ `2026-06` (và mọi tháng năm ≥ 2027): mọi NV kiểm ≥ ½ ngày thực tế làm việc
 *   (tổng ngày công hoặc ngày nghỉ thai sản) — không auto +1.
 * - Trước `2026-06` trong năm 2026: quy tắc cũ (NV cũ auto +1; NV mới chỉ tháng vào làm cần ½).
 * @param {Record<string, { workDays?: number, standardWorkDays?: number, tsDays?: number }> | null | undefined} monthWorkSummaryByYearMonth
 */
export function resolveAnnualLeaveMonthlyAccrualDays(
  startWorkingDate,
  year,
  monthWorkSummaryByYearMonth = null,
  asOfDateKey = null,
) {
  const range = resolveAnnualLeaveAccrualMonthRange(
    startWorkingDate,
    year,
    asOfDateKey,
  );
  if (!range) return 0;

  const y = Number(year);
  const newJoinerInYear = isStartWorkingDateInCalendarYear(startWorkingDate, y);
  const asOf = asOfDateKey ?? resolveAnnualLeaveYearAsOfDateKey(y);
  let accrual = 0;
  for (
    let monthIndex = range.startMonth;
    monthIndex <= range.endMonth;
    monthIndex += 1
  ) {
    if (!isAnnualLeaveAccrualMonthClosed(y, monthIndex, asOf)) {
      continue;
    }

    if (annualLeaveMonthUsesPayrollHalfAccrualRule(y, monthIndex)) {
      const summary = resolveMonthWorkSummaryForAccrual(
        monthWorkSummaryByYearMonth,
        y,
        monthIndex,
      );
      if (monthMeetsHalfStandardWorkDays(summary)) {
        accrual += 1;
      }
      continue;
    }

    if (newJoinerInYear) {
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
  { monthWorkSummaryByYearMonth = null, asOfDateKey = null } = {},
) {
  const adjustment = resolveAnnualLeaveAdjustment(row);
  const startDate = normalizeAnnualLeaveStartWorkingDate(
    row?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
  );
  if (!startDate) {
    return roundAnnualLeaveHours(
      parseAnnualLeaveNumber(
        row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
      ) + adjustment,
    );
  }

  const monthlyAccrual = resolveAnnualLeaveMonthlyAccrualDays(
    startDate,
    year,
    monthWorkSummaryByYearMonth,
    asOfDateKey,
  );
  const tenureBonus = resolveAnnualLeaveTenureBonus(
    startDate,
    year,
    asOfDateKey,
  );
  return roundAnnualLeaveHours(monthlyAccrual + tenureBonus + adjustment);
}

/** Tổng phép & tồn — luôn tính lại khi import / hiển thị. */
export function computeAnnualLeaveTotals(
  row,
  year = null,
  { monthWorkSummaryByYearMonth = null, asOfDateKey = null } = {},
) {
  const annual =
    year != null
      ? resolveAnnualLeaveCurrentYear(row, year, {
          monthWorkSummaryByYearMonth,
          asOfDateKey,
        })
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
  return Array.from(
    { length: 12 },
    (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`,
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
      listAnnualLeaveCalendarYearMonths(y).map(
        formatAnnualLeaveMonthColumnLabel,
      ),
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
