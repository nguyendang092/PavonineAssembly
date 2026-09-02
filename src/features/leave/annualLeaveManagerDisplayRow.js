import { normalizeAnnualLeaveRowStored } from "./annualLeaveDerived";

/** Một dòng lưới / xuất Excel — dữ liệu đã lưu trên Firebase (+ leaveAgg cho tháng). */
export function buildAnnualLeaveManagerDisplayRow({
  entry,
  year,
  monthValues,
  usageThroughMonthIndex = null,
}) {
  if (!entry?._raw) return null;

  return normalizeAnnualLeaveRowStored(
    entry.id,
    entry._raw,
    year,
    monthValues,
    { usageThroughMonthIndex },
  );
}
