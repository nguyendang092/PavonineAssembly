/**
 * Tích lũy S90D:
 * - PRESS = hiệu suất PRESS
 * - HAIRLINE = hiệu suất HAIRLINE / tích lũy PRESS * 100
 * - ANODIZING = hiệu suất ANODIZING / tích lũy HAIRLINE * 100
 * - ASSEMBLY = hiệu suất ASSEMBLY / tích lũy ANODIZING * 100
 */
export function computeS90dCumulativeYieldPct(
  currentYield,
  previousCumulative,
  index,
) {
  if (index === 0) {
    return currentYield ?? 0;
  }
  if (!previousCumulative) return 0;
  return Math.round(((currentYield ?? 0) / previousCumulative) * 1000) / 10;
}

/**
 * @param {Array<{ yieldPct?: number|null, totalQty?: number, cumulativeYieldPct?: number|null }>} processRows
 * @param {{ emptyAsNull?: boolean }} [options]
 */
export function applyS90dCumulativeYieldPct(processRows, { emptyAsNull = false } = {}) {
  (processRows ?? []).forEach((row, index) => {
    if (emptyAsNull && !row.totalQty) {
      row.cumulativeYieldPct = null;
      return;
    }

    const previousCumulative =
      index > 0 ? processRows[index - 1]?.cumulativeYieldPct : null;
    row.cumulativeYieldPct = computeS90dCumulativeYieldPct(
      row.yieldPct,
      previousCumulative,
      index,
    );
  });
}
