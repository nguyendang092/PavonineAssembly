function isGapDisplayZero(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return true;
  return Math.round(n * 10000) === 0;
}

function isQtyDisplayZero(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return true;
  return Math.abs(n) < 1e-9;
}

/**
 * @param {object[]} structuredMonthCodeRows
 * @param {{
 *   whFilter: string,
 *   categoryFilter: string,
 *   monthFilter: string,
 *   codeSearch: string,
 *   hideZeroMonthlyDiff: boolean,
 *   hideZeroActualQty: boolean,
 * }} filters
 */
export function filterAndSortStructuredRows(structuredMonthCodeRows, filters) {
  const {
    whFilter,
    categoryFilter,
    monthFilter,
    codeSearch,
    hideZeroMonthlyDiff,
    hideZeroActualQty,
  } = filters;
  const search = codeSearch.trim().toLowerCase();
  const baseRows = structuredMonthCodeRows.filter((r) => {
    if (whFilter && r.whFilterKey !== whFilter) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (monthFilter && r.monthKey !== monthFilter) return false;
    if (hideZeroMonthlyDiff && isGapDisplayZero(r.monthlyDiff)) return false;
    if (
      hideZeroActualQty &&
      isQtyDisplayZero(r.actualQty) &&
      isQtyDisplayZero(r.sysQty)
    ) {
      return false;
    }
    if (!search) return true;
    return (
      String(r.code).toLowerCase().includes(search) ||
      String(r.item ?? "").toLowerCase().includes(search) ||
      String(r.status ?? "").toLowerCase().includes(search) ||
      String(r.category).toLowerCase().includes(search) ||
      String(r.whCode).toLowerCase().includes(search) ||
      String(r.warehouseName ?? "").toLowerCase().includes(search) ||
      String(r.reason ?? "").toLowerCase().includes(search) ||
      String(r.unit ?? "").toLowerCase().includes(search)
    );
  });

  return baseRows;
}

export function summarizeStructuredRows(filteredStructuredRows) {
  let actual = 0;
  let sys = 0;
  let monthlyDiff = 0;
  let codeDiff = 0;
  let gapAmount = 0;
  for (const r of filteredStructuredRows) {
    actual += r.actualQty;
    sys += r.sysQty;
    monthlyDiff += r.monthlyDiff;
    codeDiff += r.codeDelta;
    gapAmount += typeof r.gapAmount === "number" ? r.gapAmount : 0;
  }
  return {
    rows: filteredStructuredRows.length,
    actual,
    sys,
    monthlyDiff,
    codeDiff,
    gapAmount,
    qtyDiffRate: Math.abs(actual) < 1e-9 ? null : monthlyDiff / actual,
  };
}
