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

    const actualDelta = (later.actualQty ?? 0) - (earlier.actualQty ?? 0);
    const sysDelta = (later.sysQty ?? 0) - (earlier.sysQty ?? 0);

    rows.push({
      ...later,
      month: `${earlier.month} → ${later.month}`,
      monthKey: `${earlierKey}__${laterKey}`,
      actualQty: actualDelta,
      sysQty: sysDelta,
      amountActual: (later.amountActual ?? 0) - (earlier.amountActual ?? 0),
      gapAmount: (later.gapAmount ?? 0) - (earlier.gapAmount ?? 0),
      monthlyDiff: actualDelta - sysDelta,
      codeDelta: actualDelta,
      amountDelta: (later.amountActual ?? 0) - (earlier.amountActual ?? 0),
      hasPrevMonth: true,
      compareFromMonth: earlier.month,
      compareToMonth: later.month,
      isMonthCompareRow: true,
    });
  }

  rows.sort((a, b) => {
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
