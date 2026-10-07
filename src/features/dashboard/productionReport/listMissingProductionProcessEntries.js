/**
 * Ngày × công đoạn chưa có sản lượng (totalQty = 0), chỉ tới throughDateKey (không báo ngày tương lai).
 * @param {{
 *   monthDailySummaries?: Array<{ dateKey?: string, dateLabel?: string, processRows?: Array<{ process?: string, totalQty?: number }> }>,
 *   processes?: string[],
 *   throughDateKey?: string,
 * }} params
 * @returns {Array<{ dateKey: string, dateLabel: string, process: string }>}
 */
export function listMissingProductionProcessEntries({
  monthDailySummaries,
  processes,
  throughDateKey,
} = {}) {
  const through = String(throughDateKey ?? "").trim();
  const processList = Array.isArray(processes) ? processes : [];
  const missing = [];

  for (const daily of monthDailySummaries ?? []) {
    const dateKey = String(daily?.dateKey ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    if (through && dateKey > through) continue;

    const qtyByProcess = new Map();
    for (const row of daily.processRows ?? []) {
      const process = String(row?.process ?? "").trim();
      if (!process) continue;
      qtyByProcess.set(process, Number(row?.totalQty ?? 0));
    }

    for (const process of processList) {
      const qty = qtyByProcess.get(process);
      if (Number.isFinite(qty) && qty > 0) continue;
      missing.push({
        dateKey,
        dateLabel: String(daily.dateLabel ?? dateKey),
        process,
      });
    }
  }

  return missing;
}

export function groupMissingProductionEntriesByDate(missing) {
  const groups = [];
  const indexByDate = new Map();
  for (const item of missing ?? []) {
    const dateKey = item.dateKey;
    if (!indexByDate.has(dateKey)) {
      indexByDate.set(dateKey, groups.length);
      groups.push({
        dateKey,
        dateLabel: item.dateLabel,
        processes: [],
      });
    }
    groups[indexByDate.get(dateKey)].processes.push(item);
  }
  return groups;
}
