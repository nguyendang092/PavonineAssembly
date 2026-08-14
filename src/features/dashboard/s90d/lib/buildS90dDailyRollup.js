import { S90D_PROCESSES } from "./s90dDefectColumns";

export const S90D_NG_RATE_TARGET_PCT = 2;

export function resolveNgRateTone(ngRatePct) {
  const rate = Number(ngRatePct) || 0;
  if (rate <= S90D_NG_RATE_TARGET_PCT) return "good";
  if (rate <= 3.5) return "warn";
  return "bad";
}

export function buildMonthDailyRollup(monthDailySummaries = []) {
  const daysWithData = monthDailySummaries.filter((daily) => daily.hasData);
  const processSet = new Set();
  monthDailySummaries.forEach((daily) => {
    daily.processRows?.forEach((row) => {
      if (row?.process) processSet.add(row.process);
    });
  });
  const processes =
    processSet.size > 0 ? [...processSet] : [...S90D_PROCESSES];
  const ngByProcess = Object.fromEntries(
    processes.map((process) => [process, 0]),
  );

  let monthTotalQty = 0;
  let monthNgQty = 0;

  daysWithData.forEach((daily) => {
    monthTotalQty += daily.totalRow?.totalQty ?? 0;
    monthNgQty += daily.totalRow?.ngQty ?? 0;
    daily.processRows.forEach((row) => {
      ngByProcess[row.process] = (ngByProcess[row.process] ?? 0) + (row.ngQty ?? 0);
    });
  });

  const avgNgRate = monthTotalQty
    ? Math.round((monthNgQty / monthTotalQty) * 1000) / 10
    : 0;

  const topNgProcess =
    processes.reduce(
      (best, process) =>
        (ngByProcess[process] ?? 0) > (ngByProcess[best] ?? 0) ? process : best,
      processes[0],
    ) ?? processes[0];

  return {
    monthTotalQty,
    monthNgQty,
    avgNgRate,
    activeDays: daysWithData.length,
    topNgProcess,
    ngTargetPct: S90D_NG_RATE_TARGET_PCT,
  };
}

export function pickDefaultDailyDateKey(monthDailySummaries = []) {
  if (!monthDailySummaries.length) return "";

  const lastWithData = [...monthDailySummaries]
    .reverse()
    .find((daily) => daily.hasData);
  if (lastWithData) return lastWithData.dateKey;

  return monthDailySummaries[monthDailySummaries.length - 1]?.dateKey ?? "";
}
