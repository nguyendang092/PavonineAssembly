import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildMonthlyRuleSummary,
  pickPayrollMonthlyTimesheetTotalWorkColumns,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import { stampPayrollMonthChunkAttendanceRootFlags } from "@/features/payroll/payrollMonthlyGridData";
import { isStartWorkingDateInCalendarYear } from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { indexAnnualLeaveYearByEmpKey } from "./annualLeaveEmpKey";

/** `yyyy-mm` của tháng có ngày vào làm trong năm `year`. */
export function resolveJoinYearMonthKey(startWorkingDate, year) {
  const text = String(startWorkingDate ?? "").trim();
  const m = text.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const y = Number(year);
  if (!Number.isFinite(y) || Number(m[1]) !== y) return null;
  return `${m[1]}-${m[2]}`;
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

/** Các tháng vào làm `yyyy-mm` cần lưới giờ công (chỉ NV vào làm trong năm). */
export function collectAccrualYearMonthsForYear(indexed, year) {
  const months = new Set();
  const y = Number(year);
  if (!Number.isFinite(y) || !indexed) return months;

  for (const { raw } of Object.values(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    if (!isStartWorkingDateInCalendarYear(startWorkingDate, y)) continue;
    const joinMonth = resolveJoinYearMonthKey(startWorkingDate, y);
    if (joinMonth) months.add(joinMonth);
  }
  return months;
}

/** Danh sách `yyyy-mm` cần tải điểm danh cho tính phép năm. */
export function listAnnualLeaveAccrualYearMonths(yearData, year) {
  if (!yearData || typeof yearData !== "object") return [];
  const y = Number(year);
  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  return [...collectAccrualYearMonthsForYear(indexed, y)].sort();
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

function buildDayChunkMapForYearMonths(
  attendanceRoot,
  attendanceRootPath,
  yearMonths,
) {
  const map = new Map();
  if (
    !attendanceRoot ||
    typeof attendanceRoot !== "object" ||
    !yearMonths?.size
  ) {
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
 * Khối TỔNG lưới tháng giờ công — chỉ tháng có ngày vào làm.
 * Tổng ngày công ≥ ½ Ngày thực tế làm việc → +1 phép tháng vào làm.
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

/**
 * Map `emp_{mnv}` → `{ "yyyy-mm": { workDays, standardWorkDays } }` từ lưới tháng giờ công.
 */
export function buildAnnualLeaveMonthWorkSummaryByEmpKey(
  attendanceRoot,
  year,
  yearData,
  { attendanceRootPath = "attendance" } = {},
) {
  const map = {};
  if (!attendanceRoot || !yearData || typeof yearData !== "object") return map;

  const y = Number(year);
  if (!Number.isFinite(y)) return map;

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const accrualYearMonths = collectAccrualYearMonthsForYear(indexed, y);
  const dayChunkMap = buildDayChunkMapForYearMonths(
    attendanceRoot,
    attendanceRootPath,
    accrualYearMonths,
  );

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const startWorkingDate = raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE];
    if (!startWorkingDate) continue;
    if (!isStartWorkingDateInCalendarYear(startWorkingDate, y)) continue;

    const joinMonth = resolveJoinYearMonthKey(startWorkingDate, y);
    if (!joinMonth) continue;

    const summary = buildAnnualLeaveMonthWorkSummary(
      dayChunkMap,
      joinMonth,
      empKey,
      startWorkingDate,
    );
    if (summary) map[empKey] = { [joinMonth]: summary };
  }

  return map;
}
