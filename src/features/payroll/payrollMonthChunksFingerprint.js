/**
 * Fingerprint nhẹ cho cache tổng hợp tháng — không hash toàn bộ payload.
 */
export function computePayrollMonthChunksFingerprint(chunkByDate, monthKeys) {
  const keys = monthKeys ?? [];
  let loadedDays = 0;
  let employeeSlots = 0;
  for (const dk of keys) {
    const ch = chunkByDate?.get?.(dk);
    if (!ch) continue;
    loadedDays += 1;
    employeeSlots += ch.employees?.length ?? 0;
  }
  return `${keys.length}|${loadedDays}|${employeeSlots}`;
}
