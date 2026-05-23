import { normalizeMonthSortKey } from "./parse";

/**
 * Gom dòng raw → bảng tháng × mã (warehouse / category / month / code).
 * @param {object[]} analysisRows
 */
export function buildStructuredMonthCodeRows(analysisRows) {
  const grouped = new Map();
  for (const r of analysisRows) {
    const whCodeOnly = String(r.whCode ?? "").trim();
    const whNameOnly = String(r.warehouseName ?? "").trim();
    const whFilterKey =
      String(r.whCode ?? r.warehouseName ?? "").trim() || "—";
    const category = String(r.category ?? "").trim() || "—";
    const code = String(r.code ?? "").trim() || "∅";
    const monthRaw = String(r.month ?? "").trim() || "—";
    const monthNorm = normalizeMonthSortKey(monthRaw);
    const monthLabel = monthNorm.display || monthRaw || "—";
    const monthKey = monthNorm.sortKey || monthLabel;
    const key = `${whFilterKey}__${category}__${monthKey}__${code}`;
    const actualQty =
      typeof r.actualQty === "number" && Number.isFinite(r.actualQty)
        ? r.actualQty
        : 0;
    const sysQty =
      typeof r.sysQty === "number" && Number.isFinite(r.sysQty) ? r.sysQty : 0;
    const amtActual =
      typeof r.amountActual === "number" && Number.isFinite(r.amountActual)
        ? r.amountActual
        : 0;
    const amtErp =
      typeof r.amountErp === "number" && Number.isFinite(r.amountErp)
        ? r.amountErp
        : 0;
    const diffAmount =
      typeof r.diffAmount === "number" && Number.isFinite(r.diffAmount)
        ? r.diffAmount
        : amtActual - amtErp;
    if (!grouped.has(key)) {
      grouped.set(key, {
        whCode: whCodeOnly || "—",
        warehouseName: whNameOnly || "—",
        whFilterKey,
        category,
        month: monthLabel,
        monthKey,
        code,
        actualQty: 0,
        sysQty: 0,
        amountActual: 0,
        gapAmount: 0,
        monthlyDiff: 0,
        reasonSet: new Set(),
        unitSet: new Set(),
      });
    }
    const row = grouped.get(key);
    if (row.whCode === "—" && whCodeOnly) row.whCode = whCodeOnly;
    if (row.warehouseName === "—" && whNameOnly) row.warehouseName = whNameOnly;
    const reasonCell = String(r.reason ?? "").trim();
    if (reasonCell) row.reasonSet.add(reasonCell);
    const unitCell = String(r.unit ?? "").trim();
    if (unitCell) row.unitSet.add(unitCell);
    row.actualQty += actualQty;
    row.sysQty += sysQty;
    row.amountActual += amtActual;
    row.gapAmount += diffAmount;
    row.monthlyDiff = row.actualQty - row.sysQty;
  }

  const actualByKeyMonth = new Map();
  const amountActualByKeyMonth = new Map();
  for (const g of grouped.values()) {
    const k = `${g.whFilterKey}__${g.category}__${g.code}`;
    if (!actualByKeyMonth.has(k)) actualByKeyMonth.set(k, new Map());
    actualByKeyMonth.get(k).set(g.monthKey, g.actualQty ?? 0);
    if (!amountActualByKeyMonth.has(k)) amountActualByKeyMonth.set(k, new Map());
    amountActualByKeyMonth.get(k).set(g.monthKey, g.amountActual ?? 0);
  }
  const prevActualByKeyMonth = new Map();
  const prevAmountActualByKeyMonth = new Map();
  for (const [k, m] of actualByKeyMonth.entries()) {
    const monthsSorted = [...m.keys()].sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
    for (let i = 0; i < monthsSorted.length; i += 1) {
      const monthKey = monthsSorted[i];
      const prevKey = i > 0 ? monthsSorted[i - 1] : null;
      const prevActual = prevKey ? (m.get(prevKey) ?? 0) : null;
      prevActualByKeyMonth.set(`${k}__${monthKey}`, prevActual);
      const amountMap = amountActualByKeyMonth.get(k);
      const prevAmountActual = prevKey ? (amountMap?.get(prevKey) ?? 0) : null;
      prevAmountActualByKeyMonth.set(`${k}__${monthKey}`, prevAmountActual);
    }
  }

  const rows = [...grouped.values()].map((g) => {
    const reasons = [...g.reasonSet].sort((a, b) => a.localeCompare(b, "vi"));
    const units = [...g.unitSet].sort((a, b) => a.localeCompare(b, "vi"));
    const rest = { ...g };
    delete rest.reasonSet;
    delete rest.unitSet;
    const k = `${g.whFilterKey}__${g.category}__${g.code}`;
    const prevActual = prevActualByKeyMonth.get(`${k}__${g.monthKey}`) ?? null;
    const prevAmountActual =
      prevAmountActualByKeyMonth.get(`${k}__${g.monthKey}`) ?? null;
    return {
      ...rest,
      reason: reasons.length ? reasons.join(", ") : "—",
      unit: units.length ? units.join(", ") : "—",
      codeDelta: prevActual == null ? 0 : (g.actualQty ?? 0) - prevActual,
      amountDelta:
        prevAmountActual == null
          ? 0
          : (g.amountActual ?? 0) - prevAmountActual,
      hasPrevMonth: prevActual != null,
    };
  });

  rows.sort((a, b) => {
    if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
    if (a.whFilterKey !== b.whFilterKey)
      return a.whFilterKey.localeCompare(b.whFilterKey, "vi");
    if (a.whCode !== b.whCode) return a.whCode.localeCompare(b.whCode, "vi");
    if (a.warehouseName !== b.warehouseName)
      return a.warehouseName.localeCompare(b.warehouseName, "vi");
    if (a.category !== b.category)
      return a.category.localeCompare(b.category, "vi");
    if (a.code !== b.code) return a.code.localeCompare(b.code, "vi");
    if (a.reason !== b.reason) return a.reason.localeCompare(b.reason, "vi");
    return a.unit.localeCompare(b.unit, "vi");
  });
  return rows;
}
