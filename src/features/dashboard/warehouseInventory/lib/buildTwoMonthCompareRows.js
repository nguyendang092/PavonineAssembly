/**
 * @param {string[]} monthKeys
 * @returns {string[]}
 */
export function normalizeCompareMonthKeys(monthKeys) {
  const uniq = [
    ...new Set(
      (monthKeys ?? [])
        .map((k) => String(k ?? "").trim())
        .filter(Boolean),
    ),
  ];
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq;
}

function identityKey(r) {
  return `${r.whFilterKey}__${r.category}__${r.code}`;
}

function sortCompareRows(a, b) {
  const byAbsQty = Math.abs(b.actualQty ?? 0) - Math.abs(a.actualQty ?? 0);
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
}

/**
 * So sánh nhiều tháng: mã phải có đủ mọi tháng đã chọn.
 * Cột số = từng tháng; Δ = tháng cuối − tháng đầu (theo thứ tự thời gian).
 * @param {object[]} structuredMonthCodeRows
 * @param {string[]} monthKeys
 */
export function buildMultiMonthCompareRows(
  structuredMonthCodeRows,
  monthKeys,
) {
  const keys = normalizeCompareMonthKeys(monthKeys);
  if (keys.length < 2) return [];

  const byCode = new Map();
  for (const r of structuredMonthCodeRows) {
    if (!keys.includes(r.monthKey)) continue;
    const id = identityKey(r);
    if (!byCode.has(id)) byCode.set(id, new Map());
    byCode.get(id).set(r.monthKey, r);
  }

  const rows = [];
  for (const [, byMonth] of byCode) {
    if (keys.some((k) => !byMonth.has(k))) continue;
    const first = byMonth.get(keys[0]);
    const last = byMonth.get(keys[keys.length - 1]);
    const months = keys.map((k) => {
      const r = byMonth.get(k);
      return {
        monthKey: k,
        month: r.month,
        actualQty: r.actualQty ?? 0,
        amountActual: r.amountActual ?? 0,
        amountErp: r.amountErp ?? 0,
      };
    });
    const head = months[0];
    const tail = months[months.length - 1];
    const actualDelta = tail.actualQty - head.actualQty;
    const sysFrom = first.sysQty ?? 0;
    const sysTo = last.sysQty ?? 0;
    const sysDelta = sysTo - sysFrom;
    const gapFrom = first.gapAmount ?? 0;
    const gapTo = last.gapAmount ?? 0;

    rows.push({
      ...last,
      month: `${head.month} → ${tail.month}`,
      monthKey: keys.join("__"),
      compareMonths: months,
      actualQtyFrom: head.actualQty,
      actualQtyTo: tail.actualQty,
      actualQty: actualDelta,
      sysQtyFrom: sysFrom,
      sysQtyTo: sysTo,
      sysQty: sysDelta,
      amountActualFrom: head.amountActual,
      amountActualTo: tail.amountActual,
      amountActual: tail.amountActual - head.amountActual,
      amountErpFrom: head.amountErp,
      amountErpTo: tail.amountErp,
      amountErp: tail.amountErp - head.amountErp,
      gapAmountFrom: gapFrom,
      gapAmountTo: gapTo,
      gapAmount: gapTo - gapFrom,
      monthlyDiff: actualDelta - sysDelta,
      codeDelta: actualDelta,
      amountDelta: tail.amountActual - head.amountActual,
      hasPrevMonth: true,
      compareFromMonth: head.month,
      compareToMonth: tail.month,
      isMonthCompareRow: true,
    });
  }

  rows.sort(sortCompareRows);
  return rows;
}

/**
 * So sánh 2 tháng (giữ API cũ).
 */
export function buildTwoMonthCompareRows(
  structuredMonthCodeRows,
  fromMonthKey,
  toMonthKey,
) {
  return buildMultiMonthCompareRows(structuredMonthCodeRows, [
    fromMonthKey,
    toMonthKey,
  ]);
}
