/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function normalizeWarehouseFxRates(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const monthKey = String(key ?? "").trim();
    if (!monthKey) continue;
    const n =
      typeof value === "number"
        ? value
        : parseFloat(String(value).trim().replace(",", "."));
    if (!Number.isFinite(n)) continue;
    out[monthKey] = n;
  }
  return out;
}
