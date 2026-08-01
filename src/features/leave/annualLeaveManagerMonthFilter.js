import { attendanceListDateForAnnualLeaveYear } from "./annualLeaveCrossLinks";

export const ANNUAL_LEAVE_MANAGER_MONTH_VALUES = Object.freeze(
  Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
);

/** Chuẩn hóa giá trị lọc tháng — rỗng = tất cả, `01`…`12` = một tháng. */
export function parseAnnualLeaveManagerMonthFilter(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const mm = raw.padStart(2, "0");
  return /^(0[1-9]|1[0-2])$/.test(mm) ? mm : "";
}

/** Chỉ số tháng 0-based từ lọc tháng — `null` khi xem cả năm. */
export function resolveAnnualLeaveManagerMonthIndex(monthFilter) {
  const mm = parseAnnualLeaveManagerMonthFilter(monthFilter);
  if (!mm) return null;
  return Number(mm) - 1;
}

/** Ngày chốt hiển thị / điểm danh khi lọc theo tháng. */
export function resolveAnnualLeaveManagerThroughDateKey(year, monthFilter = "") {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return new Date().toISOString().slice(0, 10);
  }

  const monthIndex = resolveAnnualLeaveManagerMonthIndex(monthFilter);
  if (monthIndex == null) {
    return attendanceListDateForAnnualLeaveYear(y);
  }

  const mm = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(y, monthIndex + 1, 0).getDate();
  const endKey = `${y}-${mm}-${String(lastDay).padStart(2, "0")}`;
  const today = new Date().toISOString().slice(0, 10);
  if (today.startsWith(`${y}-`) && today <= endKey) return today;
  return endKey;
}

export function filterAnnualLeaveManagerMonthColumnLabels(labels, monthFilter) {
  const monthIndex = resolveAnnualLeaveManagerMonthIndex(monthFilter);
  if (monthIndex == null || !Array.isArray(labels)) return labels;
  const label = labels[monthIndex];
  return label != null ? [label] : labels;
}

export function filterAnnualLeaveManagerMonthValues(monthValues, monthFilter) {
  const monthIndex = resolveAnnualLeaveManagerMonthIndex(monthFilter);
  if (monthIndex == null || !Array.isArray(monthValues)) return monthValues;
  return [monthValues[monthIndex] ?? 0];
}
