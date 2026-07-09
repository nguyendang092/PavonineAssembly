/**
 * Dòng ngày nghỉ phép năm (PN / 1/2PN) từ chi tiết điểm danh — chỉ ngày được tính trừ phép.
 * @param {{ months?: Array<{ yearMonth: string, displayOnly?: boolean, days?: Array<{ dateKey: string, type: string, deduction: number, displayOnly?: boolean }> }> } | null | undefined} detail
 * @returns {Array<{ dateKey: string, type: string, deduction: number, yearMonth: string }>}
 */
export function buildAnnualLeaveUsedDayRows(detail) {
  const months = Array.isArray(detail?.months) ? detail.months : [];
  const rows = [];

  for (const month of months) {
    if (month?.displayOnly) continue;
    const days = Array.isArray(month.days) ? month.days : [];
    for (const day of days) {
      if (!day?.dateKey || day.displayOnly) continue;
      rows.push({
        dateKey: day.dateKey,
        type: String(day.type ?? "").trim() || "PN",
        deduction: Number(day.deduction) || 0,
        yearMonth: month.yearMonth,
      });
    }
  }

  rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return rows;
}
