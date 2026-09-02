import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  computeAnnualLeaveTotals,
  parseAnnualLeaveNumber,
} from "./annualLeaveCalculated";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./annualLeaveBalanceLookup";
import {
  computeLiveAnnualLeaveState,
  mergeStoredAndAttendanceMonthlyUsage,
  resolveStoredMonthlyLeaveUsage,
  sumAnnualLeaveMonthlyUsageValues,
} from "./annualLeaveDerived";
import { buildAnnualLeaveMonthWorkSummaryByEmpKey } from "./annualLeavePayrollAccrual";

function mergeProfileFields(row, raw) {
  if (!raw) return row;
  return {
    ...row,
    [ANNUAL_LEAVE_EMP.FULL_NAME]:
      raw[ANNUAL_LEAVE_EMP.FULL_NAME] ?? row[ANNUAL_LEAVE_EMP.FULL_NAME],
    [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]:
      raw[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ??
      row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT],
  };
}

export function applyAnnualLeaveDetailLiveState(row, raw, state) {
  return {
    ...mergeProfileFields(row, raw),
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: state.annualLeaveCurrentYear,
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
    [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
  };
}

function buildStoredAnnualLeaveDetailDisplayRow(
  row,
  yearRowRaw,
  selectedYear,
  throughDateKey,
) {
  const totals = computeAnnualLeaveTotals(yearRowRaw, selectedYear, {
    asOfDateKey: throughDateKey,
  });

  return {
    ...mergeProfileFields(row, yearRowRaw),
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: parseAnnualLeaveNumber(
      yearRowRaw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
    ),
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]:
      totals[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
    [ANNUAL_LEAVE_EMP.BALANCE]: totals[ANNUAL_LEAVE_EMP.BALANCE],
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]:
      parseAnnualLeaveNumber(yearRowRaw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]) ??
      parseAnnualLeaveNumber(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]),
  };
}

/** Hàng hiển thị nhanh — không quét điểm danh (dùng ngay khi mở modal). */
export function buildAnnualLeaveDetailDisplayRowSnapshot({
  row,
  yearRowRaw,
  selectedYear,
  openYear,
  throughDateKey = null,
}) {
  if (!row) return null;
  if (!yearRowRaw) return row;

  const sameAsOpenYear = Number(selectedYear) === Number(openYear);
  if (
    sameAsOpenYear &&
    row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE] != null &&
    row[ANNUAL_LEAVE_EMP.BALANCE] != null
  ) {
    return mergeProfileFields(row, yearRowRaw);
  }

  return buildStoredAnnualLeaveDetailDisplayRow(
    row,
    yearRowRaw,
    selectedYear,
    throughDateKey,
  );
}

function resolveAttendanceMonthlyUsed(raw, attendanceMonthlyByEmpKey, empKey) {
  const storedMonths = resolveStoredMonthlyLeaveUsage(raw);
  const monthValues = mergeStoredAndAttendanceMonthlyUsage(
    storedMonths,
    attendanceMonthlyByEmpKey[empKey],
  );
  return sumAnnualLeaveMonthlyUsageValues(monthValues);
}

/** Giai đoạn 1 — cập nhật đã dùng từ điểm danh, chưa tính accrual lương. */
export function computeAnnualLeaveDetailUsageTotals(
  raw,
  empKey,
  attendanceRoot,
  year,
  { throughDateKey = null } = {},
) {
  if (!raw || !empKey || !attendanceRoot) return null;

  const filter = throughDateKey ? { throughDateKey } : null;
  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRoot,
      year,
      filter,
      empKey,
    );
  const monthlyUsed = resolveAttendanceMonthlyUsed(
    raw,
    attendanceMonthlyByEmpKey,
    empKey,
  );

  return computeLiveAnnualLeaveState(
    raw,
    deductionsByEmpKey[empKey] ?? 0,
    year,
    {
      usedFromMonthlySum: monthlyUsed,
      asOfDateKey: throughDateKey,
    },
  );
}

/** Giai đoạn 2 — tính phép năm live đầy đủ (cùng pipeline bảng quản lý). */
export function computeAnnualLeaveDetailLiveTotals(
  raw,
  empKey,
  attendanceRoot,
  yearData,
  year,
  {
    attendanceRootPath = "attendance",
    throughDateKey = null,
  } = {},
) {
  if (!raw || !empKey || !attendanceRoot || !yearData) return null;

  const filter = throughDateKey ? { throughDateKey } : null;
  const scopeEmpKeySet = new Set([empKey]);

  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRoot,
      year,
      filter,
      empKey,
    );

  const monthWorkSummaryByEmpKey = buildAnnualLeaveMonthWorkSummaryByEmpKey(
    attendanceRoot,
    year,
    yearData,
    { attendanceRootPath, scopeEmpKeySet },
  );

  const monthlyUsed = resolveAttendanceMonthlyUsed(
    raw,
    attendanceMonthlyByEmpKey,
    empKey,
  );

  return computeLiveAnnualLeaveState(
    raw,
    deductionsByEmpKey[empKey] ?? 0,
    year,
    {
      usedFromMonthlySum: monthlyUsed,
      monthWorkSummaryByYearMonth: monthWorkSummaryByEmpKey[empKey] ?? null,
      asOfDateKey: throughDateKey,
    },
  );
}
