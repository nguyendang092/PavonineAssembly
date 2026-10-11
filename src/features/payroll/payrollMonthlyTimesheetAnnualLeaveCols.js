import { pickPayrollEmployeeJoinDate } from "@/features/payroll/payrollEmployeeFields";
import { annualLeaveYearFromDateKey } from "@/features/leave/annualLeaveBalanceLookup";
import {
  annualLeaveGrantForCalendarMonth,
  formatAnnualLeaveDecimal,
} from "@/features/leave/annualLeaveCalculated";
import {
  mergeStoredAndAttendanceMonthlyUsage,
  resolveStoredMonthlyLeaveUsage,
} from "@/features/leave/annualLeaveDerived";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "@/features/leave/annualLeaveEmpKey";
import { ANNUAL_LEAVE_EMP } from "@/features/leave/annualLeaveFields";
import { buildAnnualLeaveManagerDisplayRow } from "@/features/leave/annualLeaveManagerDisplayRow";
import { resolveLeaveAggMonthlyValuesForEmp } from "@/features/leave/attendanceLeaveAgg";
import { resolveEmpFirebaseKeyFromPayrollMonthRowId } from "@/utils/attendanceEmployeeRecord";
import { parseLocalDateKey } from "@/utils/dateKey";

export const EMPTY_PAYROLL_MONTHLY_ANNUAL_LEAVE_COLS = Object.freeze({
  monthGrant: 0,
  balanceDisplay: "—",
});

function resolveTimesheetEmpKey(rowId, rep) {
  return (
    resolveEmpFirebaseKeyFromPayrollMonthRowId(rowId) ||
    resolveEmpFirebaseKeyFromPayrollMonthRowId(rep?.id) ||
    resolveAnnualLeaveEmpFirebaseKey({
      mnv: rep?.mnv,
      recordId: rowId ?? rep?.id,
      raw: rep,
    }) ||
    ""
  );
}

function reuseAnnualLeaveCols(previous, next) {
  if (
    previous &&
    previous.monthGrant === next.monthGrant &&
    previous.balanceDisplay === next.balanceDisplay
  ) {
    return previous;
  }
  if (
    next.monthGrant === EMPTY_PAYROLL_MONTHLY_ANNUAL_LEAVE_COLS.monthGrant &&
    next.balanceDisplay === EMPTY_PAYROLL_MONTHLY_ANNUAL_LEAVE_COLS.balanceDisplay
  ) {
    return EMPTY_PAYROLL_MONTHLY_ANNUAL_LEAVE_COLS;
  }
  return next;
}

export function formatPayrollMonthlyTimesheetAnnualLeaveBalance(balance) {
  if (balance == null || balance === "") return "—";
  const n = Number(balance);
  if (!Number.isFinite(n)) return "—";
  return formatAnnualLeaveDecimal(n);
}

export function resolvePayrollMonthlyTimesheetMonthIndex(monthFirstKey) {
  const d = parseLocalDateKey(monthFirstKey);
  return d ? d.getMonth() : null;
}

export function resolvePayrollMonthlyTimesheetYear(monthFirstKey) {
  return annualLeaveYearFromDateKey(monthFirstKey);
}

function resolveTimesheetAnnualLeaveMonthValues(empKey, entryRaw, leaveAggYearData) {
  const stored = resolveStoredMonthlyLeaveUsage(entryRaw);
  const attendance = resolveLeaveAggMonthlyValuesForEmp(leaveAggYearData, empKey);
  if (!stored && !attendance) return null;
  return mergeStoredAndAttendanceMonthlyUsage(stored, attendance);
}

/**
 * PN tháng đang xem (0/1) + Còn lại từ quản lý phép năm (cùng `normalizeAnnualLeaveRowStored`).
 */
export function resolvePayrollMonthlyTimesheetAnnualLeaveCols({
  rowId,
  rep,
  totalSummary,
  year,
  monthIndex,
  annualLeaveByEmpKey,
  leaveAggYearData = null,
  monthlyUsageByEmpKey = null,
}) {
  const empKey = resolveTimesheetEmpKey(rowId, rep);
  const entry = empKey ? annualLeaveByEmpKey?.[empKey] : null;
  const startWorkingDate =
    entry?.raw?.[ANNUAL_LEAVE_EMP.START_WORKING_DATE] ||
    pickPayrollEmployeeJoinDate(rep);

  const monthGrant = annualLeaveGrantForCalendarMonth({
    startWorkingDate,
    year,
    monthIndex,
    monthWorkSummary: totalSummary,
  });

  if (!entry?.raw) {
    return { monthGrant, balanceDisplay: "—" };
  }

  const monthValues =
    monthlyUsageByEmpKey?.[empKey] ??
    resolveTimesheetAnnualLeaveMonthValues(empKey, entry.raw, leaveAggYearData);

  const display = buildAnnualLeaveManagerDisplayRow({
    entry: { id: entry.recordId || empKey, _raw: entry.raw },
    year,
    monthValues,
  });
  return {
    monthGrant,
    balanceDisplay: formatPayrollMonthlyTimesheetAnnualLeaveBalance(
      display?.[ANNUAL_LEAVE_EMP.BALANCE],
    ),
  };
}

export function buildPayrollMonthlyTimesheetAnnualLeaveColsByRowId({
  year,
  monthIndex,
  ids,
  repById,
  summaryById,
  annualLeaveYearData,
  leaveAggYearData,
  annualLeaveByEmpKey: indexedOverride = null,
  previousByRowId = null,
}) {
  const map = new Map();
  const annualLeaveByEmpKey =
    indexedOverride ?? indexAnnualLeaveYearByEmpKey(annualLeaveYearData);

  for (const rowId of ids ?? []) {
    const rep = repById?.get?.(rowId) ?? null;
    const totalSummary = summaryById?.get?.(rowId)?.total ?? null;
    const next = resolvePayrollMonthlyTimesheetAnnualLeaveCols({
      rowId,
      rep,
      totalSummary,
      year,
      monthIndex,
      annualLeaveByEmpKey,
      leaveAggYearData,
    });
    map.set(rowId, reuseAnnualLeaveCols(previousByRowId?.get(rowId), next));
  }
  return map;
}
