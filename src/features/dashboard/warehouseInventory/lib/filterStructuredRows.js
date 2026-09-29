import { yearFromMonthKey } from "./parse";

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

function qtyValueForSort(r) {
  const n = Number(r?.actualQty);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object[]} structuredMonthCodeRows
 * @param {{
 *   whFilter: string,
 *   categoryFilter: string,
 *   monthFilter: string,
 *   yearFilter: string,
 *   codeSearch: string,
 *   hideZeroMonthlyDiff: boolean,
 *   hideZeroActualQty: boolean,
 *   qtySort: "asc" | "desc",
 * }} filters
 */
export function filterAndSortStructuredRows(structuredMonthCodeRows, filters) {
  const {
    whFilter,
    categoryFilter,
    monthFilter,
    yearFilter,
    codeSearch,
    hideZeroMonthlyDiff,
    hideZeroActualQty,
    qtySort,
  } = filters;
  const search = codeSearch.trim().toLowerCase();
  const baseRows = structuredMonthCodeRows.filter((r) => {
    if (whFilter && r.whFilterKey !== whFilter) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (yearFilter && yearFromMonthKey(r.monthKey || r.month) !== yearFilter) {
      return false;
    }
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

  const dir = qtySort === "asc" ? 1 : -1;
  return [...baseRows].sort((a, b) => {
    const d = qtyValueForSort(a) - qtyValueForSort(b);
    if (d !== 0) return d * dir;
    return String(a.code ?? "").localeCompare(String(b.code ?? ""), "vi");
  });
}

export function groupStructuredRowsByMonth(rows) {
  const map = new Map();
  for (const r of rows ?? []) {
    const monthKey = String(r.monthKey || r.month || "—");
    if (!map.has(monthKey)) {
      map.set(monthKey, {
        monthKey,
        month: r.month || monthKey,
        rows: [],
        actual: 0,
        sys: 0,
        amount: 0,
      });
    }
    const g = map.get(monthKey);
    g.rows.push(r);
    g.actual += Number(r.actualQty) || 0;
    g.sys += Number(r.sysQty) || 0;
    g.amount += Number(r.amountActual) || 0;
  }
  return [...map.values()].sort((a, b) =>
    String(a.monthKey).localeCompare(String(b.monthKey)),
  );
}

export function summarizeStructuredRowsByMonth(rows) {
  return groupStructuredRowsByMonth(rows).map((g) => ({
    monthKey: g.monthKey,
    month: g.month,
    ...summarizeStructuredRows(g.rows),
  }));
}

export function summarizeStructuredRows(filteredStructuredRows) {
  let actual = 0;
  let sys = 0;
  let monthlyDiff = 0;
  let codeDiff = 0;
  let gapAmount = 0;
  let amountActual = 0;
  for (const r of filteredStructuredRows) {
    actual += r.actualQty;
    sys += r.sysQty;
    monthlyDiff += r.monthlyDiff;
    codeDiff += r.codeDelta;
    gapAmount += typeof r.gapAmount === "number" ? r.gapAmount : 0;
    amountActual += typeof r.amountActual === "number" ? r.amountActual : 0;
  }
  return {
    rows: filteredStructuredRows.length,
    actual,
    sys,
    monthlyDiff,
    codeDiff,
    gapAmount,
    amountActual,
    qtyDiffRate: Math.abs(actual) < 1e-9 ? null : monthlyDiff / actual,
    changedQtyRows: filteredStructuredRows.filter(
      (r) => Math.abs(r.actualQty ?? 0) >= 1e-9,
    ).length,
  };
}
