function isGapDisplayZero(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return true;
  return Math.round(n * 10000) === 0;
}

function compareByNatural(a, b) {
  if (a.monthKey !== b.monthKey) {
    return String(a.monthKey).localeCompare(String(b.monthKey));
  }
  if (a.whFilterKey !== b.whFilterKey) {
    return a.whFilterKey.localeCompare(b.whFilterKey, "vi");
  }
  if (a.category !== b.category) {
    return a.category.localeCompare(b.category, "vi");
  }
  if (a.whCode !== b.whCode) return a.whCode.localeCompare(b.whCode, "vi");
  if (a.warehouseName !== b.warehouseName) {
    return a.warehouseName.localeCompare(b.warehouseName, "vi");
  }
  return 0;
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
 *   softSortMode: string,
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
    softSortMode,
  } = filters;
  const search = codeSearch.trim().toLowerCase();
  const baseRows = structuredMonthCodeRows.filter((r) => {
    if (whFilter && r.whFilterKey !== whFilter) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (monthFilter && r.monthKey !== monthFilter) return false;
    if (hideZeroMonthlyDiff && isGapDisplayZero(r.monthlyDiff)) return false;
    if (hideZeroActualQty && Math.abs(r.actualQty) < 1e-9) return false;
    if (!search) return true;
    return (
      String(r.code).toLowerCase().includes(search) ||
      String(r.category).toLowerCase().includes(search) ||
      String(r.whCode).toLowerCase().includes(search) ||
      String(r.warehouseName ?? "").toLowerCase().includes(search) ||
      String(r.reason ?? "").toLowerCase().includes(search) ||
      String(r.unit ?? "").toLowerCase().includes(search)
    );
  });

  if (softSortMode === "abs_desc") {
    return [...baseRows].sort(
      (a, b) =>
        Math.abs(Number(b.amountDelta ?? 0)) -
          Math.abs(Number(a.amountDelta ?? 0)) ||
        Number(b.amountDelta ?? 0) - Number(a.amountDelta ?? 0) ||
        compareByNatural(a, b) ||
        0,
    );
  }
  if (softSortMode === "pos_desc") {
    return [...baseRows].sort(
      (a, b) =>
        Number(b.amountDelta ?? 0) - Number(a.amountDelta ?? 0) ||
        Math.abs(Number(b.amountDelta ?? 0)) -
          Math.abs(Number(a.amountDelta ?? 0)) ||
        compareByNatural(a, b) ||
        0,
    );
  }
  if (softSortMode === "neg_asc") {
    return [...baseRows].sort(
      (a, b) =>
        Number(a.amountDelta ?? 0) - Number(b.amountDelta ?? 0) ||
        Math.abs(Number(b.amountDelta ?? 0)) -
          Math.abs(Number(a.amountDelta ?? 0)) ||
        compareByNatural(a, b) ||
        0,
    );
  }
  if (softSortMode === "month") {
    return [...baseRows].sort(
      (a, b) =>
        compareByNatural(a, b) ||
        a.code.localeCompare(b.code, "vi") ||
        a.reason.localeCompare(b.reason, "vi") ||
        a.unit.localeCompare(b.unit, "vi"),
    );
  }
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
