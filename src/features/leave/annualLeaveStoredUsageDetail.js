import {
  createEmptyAnnualLeaveUsageDetail,
} from "./annualLeaveBalanceLookup";
import {
  ATTENDANCE_LEAVE_AGG_EMP,
} from "./attendanceLeaveAggFields";
import {
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
  listAnnualLeaveDetailHistoryMonths,
  listAnnualLeavePreCountDisplayMonthKeys,
} from "./annualLeaveFields";
import { roundAnnualLeaveHours } from "./annualLeaveCalculated";

function normalizeUsageDetailFilter(filterOrYearMonth) {
  if (filterOrYearMonth == null) return {};
  if (typeof filterOrYearMonth === "string") {
    return { yearMonthPrefix: filterOrYearMonth };
  }
  return filterOrYearMonth;
}

function emptyUsageMonth(yearMonth, { displayOnly = false } = {}) {
  return {
    yearMonth,
    pnCount: 0,
    halfPnCount: 0,
    totalDeduction: 0,
    days: [],
    displayOnly,
  };
}

function monthCountsTowardDeduction(year, yearMonth) {
  const probeDateKey = `${yearMonth}-15`;
  return isAttendanceDateCountedForAnnualLeave(probeDateKey, year);
}

function normalizeLeaveAggMonthMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object") return {};
  const out = {};
  for (const [monthKey, value] of Object.entries(rawMap)) {
    if (!/^(0[1-9]|1[0-2])$/.test(monthKey)) continue;
    const rounded = roundAnnualLeaveHours(Number(value ?? 0));
    if (rounded === 0) continue;
    out[monthKey] = rounded;
  }
  return out;
}

/** Gói chi tiết PN để ghi vào `attendanceLeaveAgg/{year}/{empKey}`. */
export function serializeAnnualLeaveUsageDetailForLeaveAgg(detail) {
  if (!detail || typeof detail !== "object") return null;
  const months = Array.isArray(detail.months)
    ? detail.months
    : Object.values(detail.months ?? {});
  if (!months.length) return null;

  return {
    totalPn: Number(detail.totalPn ?? 0),
    totalHalfPn: Number(detail.totalHalfPn ?? 0),
    totalDeduction: roundAnnualLeaveHours(Number(detail.totalDeduction ?? 0)),
    months: months.map((month) => ({
      yearMonth: month.yearMonth,
      pnCount: Number(month.pnCount ?? 0),
      halfPnCount: Number(month.halfPnCount ?? 0),
      totalDeduction: roundAnnualLeaveHours(Number(month.totalDeduction ?? 0)),
      displayOnly: Boolean(month.displayOnly),
      days: Array.isArray(month.days)
        ? month.days.map((day) => ({
            dateKey: day.dateKey,
            type: day.type,
            deduction: roundAnnualLeaveHours(Number(day.deduction ?? 0)),
            displayOnly: Boolean(day.displayOnly),
          }))
        : [],
    })),
  };
}

function dayPassesFilter(dateKey, year, { yearMonthPrefix = null, throughDateKey = null }) {
  const yearPrefix = `${year}-`;
  if (!dateKey?.startsWith(yearPrefix)) return false;
  if (yearMonthPrefix && !dateKey.startsWith(`${yearMonthPrefix}-`)) return false;
  if (throughDateKey && dateKey > throughDateKey) return false;
  return true;
}

function summarizeUsageDays(days, year, yearMonth, filter) {
  let pnCount = 0;
  let halfPnCount = 0;
  let totalDeduction = 0;
  let displayOnly = false;
  const keptDays = [];

  for (const day of days) {
    if (!day?.dateKey) continue;
    if (!dayPassesFilter(day.dateKey, year, filter)) continue;
    if (String(day.dateKey).slice(0, 7) !== yearMonth) continue;

    const deduction = roundAnnualLeaveHours(Number(day.deduction ?? 0));
    const isDisplayOnly =
      Boolean(day.displayOnly) ||
      isAttendanceDateDisplayOnlyForAnnualLeave(day.dateKey, year);

    keptDays.push({
      dateKey: day.dateKey,
      type: day.type,
      deduction,
      displayOnly: isDisplayOnly,
    });

    if (isDisplayOnly) {
      displayOnly = true;
      if (deduction === 1) pnCount += 1;
      else if (deduction === 0.5) halfPnCount += 1;
      continue;
    }

    if (deduction === 1) pnCount += 1;
    else if (deduction === 0.5) halfPnCount += 1;
    totalDeduction = roundAnnualLeaveHours(totalDeduction + deduction);
  }

  keptDays.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    yearMonth,
    pnCount,
    halfPnCount,
    totalDeduction: displayOnly ? 0 : totalDeduction,
    days: keptDays,
    displayOnly,
  };
}

/** Áp filter khi đọc chi tiết đã lưu (throughDateKey / tháng). */
export function filterStoredAnnualLeaveUsageDetail(
  storedDetail,
  year,
  filterOrYearMonth = null,
) {
  const filter = normalizeUsageDetailFilter(filterOrYearMonth);
  const { throughDateKey = null } = filter;

  if (!storedDetail?.months?.length) {
    return createEmptyAnnualLeaveUsageDetail(year, filterOrYearMonth);
  }

  const byMonth = {};
  for (const month of storedDetail.months) {
    if (!month?.yearMonth) continue;
    byMonth[month.yearMonth] = summarizeUsageDays(
      month.days ?? [],
      year,
      month.yearMonth,
      filter,
    );
  }

  let totalPn = 0;
  let totalHalfPn = 0;
  let totalDeduction = 0;

  const monthKeys = listAnnualLeaveDetailHistoryMonths(year, throughDateKey);
  const countedRows = monthKeys.map((yearMonth) => {
    const month =
      byMonth[yearMonth] ?? emptyUsageMonth(yearMonth, { displayOnly: false });
    if (!month.displayOnly) {
      totalPn += month.pnCount;
      totalHalfPn += month.halfPnCount;
      totalDeduction = roundAnnualLeaveHours(
        totalDeduction + month.totalDeduction,
      );
    }
    return month;
  });

  const preCountRows = listAnnualLeavePreCountDisplayMonthKeys(year)
    .filter((yearMonth) => (byMonth[yearMonth]?.days?.length ?? 0) > 0)
    .map((yearMonth) => {
      const month = byMonth[yearMonth];
      return {
        ...month,
        displayOnly: true,
        totalDeduction: 0,
      };
    });

  return {
    totalPn,
    totalHalfPn,
    totalDeduction,
    months: [...countedRows, ...preCountRows],
  };
}

function buildFallbackUsageDetailFromDeductionByMonth(
  empNode,
  year,
  filterOrYearMonth = null,
) {
  const filter = normalizeUsageDetailFilter(filterOrYearMonth);
  const { throughDateKey = null } = filter;
  const monthMap = normalizeLeaveAggMonthMap(
    empNode?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
  );

  const monthKeys = listAnnualLeaveDetailHistoryMonths(year, throughDateKey);
  const months = monthKeys.map((yearMonth) => {
    const monthKey = yearMonth.slice(5, 7);
    const totalDeduction = roundAnnualLeaveHours(Number(monthMap[monthKey] ?? 0));
    const counted = monthCountsTowardDeduction(year, yearMonth);
    return {
      yearMonth,
      pnCount: 0,
      halfPnCount: 0,
      totalDeduction: counted ? totalDeduction : 0,
      days: [],
      displayOnly: !counted && totalDeduction > 0,
    };
  });

  const totalDeduction = roundAnnualLeaveHours(
    months.reduce(
      (sum, month) =>
        month.displayOnly ? sum : sum + Number(month.totalDeduction ?? 0),
      0,
    ),
  );

  return {
    totalPn: 0,
    totalHalfPn: 0,
    totalDeduction,
    months,
  };
}

/** Đọc chi tiết PN từ node `attendanceLeaveAgg/{year}/{empKey}`. */
export function readAnnualLeaveUsageDetailFromLeaveAggEmp(
  empNode,
  year,
  filterOrYearMonth = null,
) {
  const stored = empNode?.[ATTENDANCE_LEAVE_AGG_EMP.USAGE_DETAIL];
  if (stored?.months?.length) {
    return filterStoredAnnualLeaveUsageDetail(stored, year, filterOrYearMonth);
  }
  return buildFallbackUsageDetailFromDeductionByMonth(
    empNode,
    year,
    filterOrYearMonth,
  );
}
