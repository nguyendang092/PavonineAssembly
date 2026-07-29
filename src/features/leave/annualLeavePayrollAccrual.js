import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import { stampPayrollMonthChunkAttendanceRootFlags } from "@/features/payroll/payrollMonthlyGridData";
import { resolveAnnualLeaveYearAsOfDateKey } from "./annualLeaveCalculated";
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

/** Chỉ parse ngày thuộc các tháng vào làm cần tính accrual — tránh quét cả năm điểm danh. */
function collectJoinYearMonthsForYear(indexed, year) {
  const months = new Set();
  for (const { raw } of Object.values(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    const join = parseAnnualLeaveIsoDate(startWorkingDate);
    if (!join || join.getFullYear() !== year) continue;
    months.add(`${year}-${String(join.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
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
 * Tổng hợp giờ công tháng vào làm — `{ workDays, standardWorkDays }` khối `total`.
 */
export function buildAnnualLeaveJoinMonthWorkSummary(
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

  return {
    workDays: summary?.total?.workDays ?? 0,
    standardWorkDays: summary?.total?.standardWorkDays ?? 0,
  };
}

/**
 * Map `emp_{mnv}` → giờ công tháng vào làm (chỉ NV có START WORKING DATE trong năm đang xét).
 */
export function buildAnnualLeaveJoinMonthWorkSummaryByEmpKey(
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
  const joinYearMonths = collectJoinYearMonthsForYear(indexed, y);
  const dayChunkMap = buildDayChunkMapForYearMonths(
    attendanceRoot,
    attendanceRootPath,
    joinYearMonths,
  );

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    const join = parseAnnualLeaveIsoDate(startWorkingDate);
    if (!join || join.getFullYear() !== y) continue;

    const yearMonth = `${y}-${String(join.getMonth() + 1).padStart(2, "0")}`;
    if (asOf && String(asOf).slice(0, 7) < yearMonth) continue;

    const summary = buildAnnualLeaveJoinMonthWorkSummary(
      dayChunkMap,
      yearMonth,
      empKey,
      startWorkingDate,
    );
    if (summary) map[empKey] = summary;
  }

  return map;
}
