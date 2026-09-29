import { normalizeMonthSortKey } from "./parse";

/**
 * Khóa dòng để gộp upload: kho + loại + tháng + CODE.
 * Upload file mới giữ tháng/mã cũ; dòng trùng khóa thì lấy bản mới.
 */
export function warehouseInventoryRowMergeKey(row) {
  const wh = String(row?.whCode ?? row?.warehouseName ?? "").trim() || "—";
  const category = String(row?.category ?? "").trim() || "—";
  const code = String(row?.code ?? "").trim() || "∅";
  const monthRaw = String(row?.month ?? "").trim() || "—";
  const monthKey = normalizeMonthSortKey(monthRaw).sortKey || monthRaw;
  return `${wh}__${category}__${monthKey}__${code}`;
}

export function warehouseInventoryRowMonthKey(row) {
  const monthRaw = String(row?.month ?? "").trim() || "—";
  return normalizeMonthSortKey(monthRaw).sortKey || monthRaw;
}

/**
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
export function mergeWarehouseInventoryRows(existing, incoming) {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  if (next.length === 0) return prev;

  const incomingKeys = new Set(next.map(warehouseInventoryRowMergeKey));
  const kept = prev.filter(
    (row) => !incomingKeys.has(warehouseInventoryRowMergeKey(row)),
  );
  return [...kept, ...next];
}

/**
 * @param {object[]} rows
 * @param {string} monthKey — `YYYY-MM`
 * @returns {object[]}
 */
export function removeWarehouseInventoryRowsByMonth(rows, monthKey) {
  const key = String(monthKey ?? "").trim();
  const prev = Array.isArray(rows) ? rows : [];
  if (!key) return prev;
  return prev.filter((row) => warehouseInventoryRowMonthKey(row) !== key);
}
