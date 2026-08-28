import {
  normalizeAnnualLeaveRowLive,
  normalizeAnnualLeaveRowStored,
} from "./annualLeaveDerived";

/** Một dòng lưới / xuất Excel — cùng logic hiển thị sau khi tính điểm danh live. */
export function buildAnnualLeaveManagerDisplayRow({
  entry,
  year,
  monthValues,
  usageThroughMonthIndex = null,
  attendanceUsageReady = false,
  attendanceAccrualReady = false,
  deductionsByEmpKey = {},
  monthWorkSummaryByEmpKey = {},
  accrualAsOfDateKey = null,
}) {
  if (!entry?._raw) return null;

  const storedRow = normalizeAnnualLeaveRowStored(
    entry.id,
    entry._raw,
    year,
    monthValues,
    { usageThroughMonthIndex },
  );
  if (!storedRow) return null;
  if (!attendanceUsageReady) return storedRow;

  return (
    normalizeAnnualLeaveRowLive(
      entry.id,
      entry._raw,
      deductionsByEmpKey,
      year,
      monthValues,
      attendanceAccrualReady
        ? (monthWorkSummaryByEmpKey[entry.id] ?? null)
        : null,
      {
        asOfDateKey: accrualAsOfDateKey,
        usageThroughMonthIndex,
      },
    ) ?? storedRow
  );
}
