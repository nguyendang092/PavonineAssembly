/**
 * So sánh 2 tháng: chỉ giữ mã trùng khớp (kho + 구분 + CODE),
 * giá trị số = tháng sau − tháng trước.
 * @param {object[]} structuredMonthCodeRows
 * @param {string} fromMonthKey
 * @param {string} toMonthKey
 */
export function buildTwoMonthCompareRows(
  structuredMonthCodeRows,
  fromMonthKey,
  toMonthKey,
) {
  const from = String(fromMonthKey ?? "").trim();
  const to = String(toMonthKey ?? "").trim();
  if (!from || !to || from === to) return [];

  let earlierKey = from;
  let laterKey = to;
  if (from.localeCompare(to) > 0) {
    earlierKey = to;
    laterKey = from;
  }

  const earlierByKey = new Map();
  const laterByKey = new Map();

  for (const r of structuredMonthCodeRows) {
    const k = `${r.whFilterKey}__${r.category}__${r.code}`;
    if (r.monthKey === earlierKey) earlierByKey.set(k, r);
    if (r.monthKey === laterKey) laterByKey.set(k, r);
  }

  const rows = [];
  for (const [k, later] of laterByKey) {
    const earlier = earlierByKey.get(k);
    if (!earlier) continue;

    const actualFrom = earlier.actualQty ?? 0;
    const actualTo = later.actualQty ?? 0;
    const sysFrom = earlier.sysQty ?? 0;
    const sysTo = later.sysQty ?? 0;
    const amountFrom = earlier.amountActual ?? 0;
    const amountTo = later.amountActual ?? 0;
    const gapFrom = earlier.gapAmount ?? 0;
    const gapTo = later.gapAmount ?? 0;
    const actualDelta = actualTo - actualFrom;
    const sysDelta = sysTo - sysFrom;

    rows.push({
      ...later,
      month: `${earlier.month} → ${later.month}`,
      monthKey: `${earlierKey}__${laterKey}`,
      actualQtyFrom: actualFrom,
      actualQtyTo: actualTo,
      actualQty: actualDelta,
      sysQtyFrom: sysFrom,
      sysQtyTo: sysTo,
      sysQty: sysDelta,
      amountActualFrom: amountFrom,
      amountActualTo: amountTo,
      amountActual: amountTo - amountFrom,
      gapAmountFrom: gapFrom,
      gapAmountTo: gapTo,
      gapAmount: gapTo - gapFrom,
      monthlyDiff: actualDelta - sysDelta,
      codeDelta: actualDelta,
      amountDelta: amountTo - amountFrom,
      hasPrevMonth: true,
      compareFromMonth: earlier.month,
      compareToMonth: later.month,
      isMonthCompareRow: true,
    });
  }

  rows.sort((a, b) => {
    const byAbsQty =
      Math.abs(b.actualQty ?? 0) - Math.abs(a.actualQty ?? 0);
    if (byAbsQty) return byAbsQty;
    const byAbsAmt =
      Math.abs(b.amountActual ?? 0) - Math.abs(a.amountActual ?? 0);
    if (byAbsAmt) return byAbsAmt;
    if (a.whFilterKey !== b.whFilterKey) {
      return a.whFilterKey.localeCompare(b.whFilterKey, "vi");
    }
    if (a.whCode !== b.whCode) return a.whCode.localeCompare(b.whCode, "vi");
    if (a.warehouseName !== b.warehouseName) {
      return a.warehouseName.localeCompare(b.warehouseName, "vi");
    }
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category, "vi");
    }
    if (a.code !== b.code) return a.code.localeCompare(b.code, "vi");
    if (a.reason !== b.reason) return a.reason.localeCompare(b.reason, "vi");
    return a.unit.localeCompare(b.unit, "vi");
  });

  return rows;
}
