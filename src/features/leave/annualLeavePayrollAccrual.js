import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildMonthlyRuleSummary,
  pickPayrollMonthlyTimesheetTotalWorkColumns,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import { stampPayrollMonthChunkAttendanceRootFlags } from "@/features/payroll/payrollMonthlyGridData";
import {
  resolveAnnualLeaveAccrualMonthRange,
  resolveAnnualLeaveYearAsOfDateKey,
  isStartWorkingDateInCalendarYear,
} from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";

function parseAnnualLeaveIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Tất cả ngày lịch trong `yyyy-mm`. */
export function listCalendarDateKeysForYearMonth(yearMonth) {
  const text = String(yearMonth ?? "").trim();
  const m = text.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return [];
  }
  const dayCount = new Date(y, mo, 0).getDate();
  return Array.from({ length: dayCount }, (_, i) => {
    const day = i + 1;
    return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

/** Các tháng `yyyy-mm` cần giờ công để tính +1 phép (hợp nhất mọi NV). */
export function collectAccrualYearMonthsForYear(indexed, year, asOfDateKey) {
  const months = new Set();
  const y = Number(year);
  if (!Number.isFinite(y) || !indexed) return months;

  for (const { raw } of Object.values(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    if (!isStartWorkingDateInCalendarYear(startWorkingDate, y)) continue;
    const range = resolveAnnualLeaveAccrualMonthRange(
      startWorkingDate,
      y,
      asOfDateKey,
    );
    if (!range) continue;
    for (let m = range.startMonth; m <= range.endMonth; m += 1) {
      months.add(`${y}-${String(m + 1).padStart(2, "0")}`);
    }
  }
  return months;
}

/** Danh sách `yyyy-mm` cần tải điểm danh cho tính phép năm. */
export function listAnnualLeaveAccrualYearMonths(
  yearData,
  year,
  asOfDateKey = null,
) {
  if (!yearData || typeof yearData !== "object") return [];
  const y = Number(year);
  const asOf = asOfDateKey ?? resolveAnnualLeaveYearAsOfDateKey(y);
  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  return [...collectAccrualYearMonthsForYear(indexed, y, asOf)].sort();
}

/** @deprecated Dùng `listAnnualLeaveAccrualYearMonths`. */
export function listAnnualLeaveJoinYearMonths(yearData, year) {
  return listAnnualLeaveAccrualYearMonths(yearData, year);
}

/** Khoảng ngày RTDB điểm danh bao trùm các tháng tính phép. */
export function resolveAccrualYearMonthsAttendanceRange(yearMonths) {
  if (!yearMonths?.length) return null;
  const sorted = [...yearMonths].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const m = last.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
  const lastDay = new Date(y, mo, 0).getDate();
  return {
    startAt: `${first}-01`,
    endAt: `${last}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** @deprecated Dùng `resolveAccrualYearMonthsAttendanceRange`. */
export function resolveJoinYearMonthsAttendanceRange(yearMonths) {
  return resolveAccrualYearMonthsAttendanceRange(yearMonths);
}

function buildDayChunkMapForYearMonths(
  attendanceRoot,
  attendanceRootPath,
  yearMonths,
) {
  const map = new Map();
  if (!attendanceRoot || typeof attendanceRoot !== "object" || !yearMonths?.size) {
    return map;
  }

  for (const yearMonth of yearMonths) {
    for (const dateKey of listCalendarDateKeysForYearMonth(yearMonth)) {
      const raw = attendanceRoot[dateKey];
      if (!raw) continue;
      const chunk = stampPayrollMonthChunkAttendanceRootFlags(
        buildPayrollMonthDayChunkFromRaw(raw, dateKey),
        attendanceRootPath,
      );
      if (chunk) map.set(dateKey, chunk);
    }
  }
  return map;
}

/**
 * Hai cột khối TỔNG lưới tháng giờ công cho một tháng.
 * Tổng ngày công ≥ ½ Ngày thực tế làm việc → +1 phép tháng đó.
 */
export function buildAnnualLeaveMonthWorkSummary(
  dayChunkMap,
  yearMonth,
  empKey,
  startWorkingDate,
) {
  if (!dayChunkMap || !empKey || !startWorkingDate) return null;

  const monthKeys = listCalendarDateKeysForYearMonth(yearMonth);
  if (!monthKeys.length) return null;

  const chunkMap = new Map();
  for (const dateKey of monthKeys) {
    const chunk = dayChunkMap.get(dateKey);
    if (chunk) chunkMap.set(dateKey, chunk);
  }

  const summary = buildMonthlyRuleSummary(chunkMap, monthKeys, empKey, {
    ngayVaoLam: startWorkingDate,
  });

  return pickPayrollMonthlyTimesheetTotalWorkColumns(summary?.total);
}

/** @deprecated Dùng `buildAnnualLeaveMonthWorkSummary`. */
export function buildAnnualLeaveJoinMonthWorkSummary(
  dayChunkMap,
  yearMonth,
  empKey,
  startWorkingDate,
) {
  return buildAnnualLeaveMonthWorkSummary(
    dayChunkMap,
    yearMonth,
    empKey,
    startWorkingDate,
  );
}

function accrualYearMonthsForEmployee(startWorkingDate, year, asOfDateKey) {
  const range = resolveAnnualLeaveAccrualMonthRange(
    startWorkingDate,
    year,
    asOfDateKey,
  );
  if (!range) return [];
  const y = Number(year);
  const months = [];
  for (let m = range.startMonth; m <= range.endMonth; m += 1) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * Map `emp_{mnv}` → `{ "yyyy-mm": { workDays, standardWorkDays } }` từ lưới tháng giờ công.
 */
export function buildAnnualLeaveMonthWorkSummaryByEmpKey(
  attendanceRoot,
  year,
  yearData,
  {
    attendanceRootPath = "attendance",
    asOfDateKey = null,
  } = {},
) {
  const map = {};
  if (!attendanceRoot || !yearData || typeof yearData !== "object") return map;

  const y = Number(year);
  if (!Number.isFinite(y)) return map;

  const asOf = asOfDateKey ?? resolveAnnualLeaveYearAsOfDateKey(y);
  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const accrualYearMonths = collectAccrualYearMonthsForYear(indexed, y, asOf);
  const dayChunkMap = buildDayChunkMapForYearMonths(
    attendanceRoot,
    attendanceRootPath,
    accrualYearMonths,
  );

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    if (!startWorkingDate) continue;
    if (!isStartWorkingDateInCalendarYear(startWorkingDate, y)) continue;

    const byMonth = {};
    for (const yearMonth of accrualYearMonthsForEmployee(
      startWorkingDate,
      y,
      asOf,
    )) {
      const summary = buildAnnualLeaveMonthWorkSummary(
        dayChunkMap,
        yearMonth,
        empKey,
        startWorkingDate,
      );
      if (summary) byMonth[yearMonth] = summary;
    }
    if (Object.keys(byMonth).length) map[empKey] = byMonth;
  }

  return map;
}

/** @deprecated Dùng `buildAnnualLeaveMonthWorkSummaryByEmpKey`. */
export function buildAnnualLeaveJoinMonthWorkSummaryByEmpKey(
  attendanceRoot,
  year,
  yearData,
  options = {},
) {
  return buildAnnualLeaveMonthWorkSummaryByEmpKey(
    attendanceRoot,
    year,
    yearData,
    options,
  );
}
