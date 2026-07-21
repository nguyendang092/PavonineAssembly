import { format, parseISO } from "date-fns";
import { S90D_DEFECT_COLUMNS, S90D_PROCESSES } from "./s90dDefectColumns";

export function formatS90dChartDayTick(dateKey) {
  try {
    return format(parseISO(dateKey), "dd/MM");
  } catch {
    return String(dateKey ?? "");
  }
}

export function formatS90dChartFullDate(dateKey, locale = "vi-VN") {
  try {
    const date = parseISO(dateKey);
    return date.toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return String(dateKey ?? "");
  }
}

function emptyDefectMap() {
  return Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, 0]));
}

export function mergeDailyDefectTotals(monthDailySummaries) {
  const defects = emptyDefectMap();
  let totalQty = 0;

  (monthDailySummaries ?? []).forEach((daily) => {
    if (!daily.hasData) return;
    totalQty += daily.totalRow?.totalQty ?? 0;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      defects[key] += daily.totalRow?.defects?.[key] ?? 0;
    });
  });

  return { totalQty, defects };
}

export function buildS90dChartKpiSummary(summary) {
  const totalRow = summary?.totalRow ?? {};
  return {
    totalQty: totalRow.totalQty ?? 0,
    okQty: totalRow.okQty ?? 0,
    ngQty: totalRow.ngQty ?? 0,
    yieldPct: totalRow.yieldPct ?? 0,
    ngRatePct: totalRow.ngRatePct ?? 0,
    defectTotal: totalRow.defectTotal ?? 0,
    activeDays: summary?.activeDays ?? 0,
    activeProcesses: summary?.activeProcesses ?? 0,
  };
}

export function buildS90dOkNgPieData(summary) {
  const okQty = summary?.totalRow?.okQty ?? 0;
  const ngQty = summary?.totalRow?.ngQty ?? 0;
  const total = okQty + ngQty;
  if (total <= 0) return [];

  return [
    { key: "ok", nameKey: "ok", value: okQty, pct: (okQty / total) * 100 },
    { key: "ng", nameKey: "ng", value: ngQty, pct: (ngQty / total) * 100 },
  ];
}

export function buildS90dTotalProcessChartData(summary, processLabelFn) {
  return (summary?.processRows ?? []).map((row) => ({
    process: row.process,
    label: processLabelFn(row.process),
    okQty: row.okQty ?? 0,
    ngQty: row.ngQty ?? 0,
    totalQty: row.totalQty ?? 0,
    yieldPct: row.yieldPct ?? 0,
    ngRatePct: row.ngRatePct ?? 0,
    cumulativeYieldPct: row.cumulativeYieldPct ?? 0,
  }));
}

export function buildS90dYieldComparisonData(summary, processLabelFn) {
  return buildS90dTotalProcessChartData(summary, processLabelFn).filter(
    (row) => row.totalQty > 0,
  );
}

export function buildS90dDailyTrendChartData(monthDailySummaries) {
  return (monthDailySummaries ?? [])
    .filter((daily) => daily.hasData)
    .map((daily) => ({
      dateKey: daily.dateKey,
      label: formatS90dChartDayTick(daily.dateKey),
      fullLabel: formatS90dChartFullDate(daily.dateKey),
      okQty: daily.totalRow?.okQty ?? 0,
      ngQty: daily.totalRow?.ngQty ?? 0,
      totalQty: daily.totalRow?.totalQty ?? 0,
      yieldPct: daily.totalRow?.yieldPct ?? 0,
      ngRatePct: daily.totalRow?.ngRatePct ?? 0,
    }));
}

export function buildS90dDailyProcessStackData(
  monthDailySummaries,
  processLabelFn,
) {
  return (monthDailySummaries ?? [])
    .filter((daily) => daily.hasData)
    .map((daily) => {
      const row = {
        dateKey: daily.dateKey,
        label: formatS90dChartDayTick(daily.dateKey),
      };
      S90D_PROCESSES.forEach((process) => {
        const processRow = daily.processRows?.find(
          (item) => item.process === process,
        );
        row[process] = processRow?.totalQty ?? 0;
        row[`${process}Label`] = processLabelFn(process);
      });
      return row;
    });
}

export function getTopDefectKeys(defects, limit = 6) {
  return S90D_DEFECT_COLUMNS.map(({ key }) => ({
    key,
    count: defects?.[key] ?? 0,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => row.key);
}

export function buildS90dTopDefectChartData(
  summary,
  defectLabelFn,
  limit = 10,
) {
  const defects = summary?.totalRow?.defects ?? {};
  const totalQty = summary?.totalRow?.totalQty ?? 0;
  const totalDefects = Object.values(defects).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  return S90D_DEFECT_COLUMNS.map(({ key }) => ({
    key,
    label: defectLabelFn(key),
    count: defects[key] ?? 0,
    pct:
      totalQty > 0
        ? ((defects[key] ?? 0) / totalQty) * 100
        : totalDefects > 0
          ? ((defects[key] ?? 0) / totalDefects) * 100
          : 0,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function buildS90dDefectByProcessData(
  summary,
  defectLabelFn,
  processLabelFn,
  topDefectLimit = 5,
) {
  const topKeys = getTopDefectKeys(
    summary?.totalRow?.defects ?? {},
    topDefectLimit,
  );
  if (!topKeys.length) return { rows: [], topKeys: [], keyLabels: {} };

  const keyLabels = Object.fromEntries(
    topKeys.map((key) => [key, defectLabelFn(key)]),
  );

  const rows = (summary?.processRows ?? [])
    .map((row) => {
      const entry = {
        process: row.process,
        label: processLabelFn(row.process),
        totalDefects: 0,
      };
      topKeys.forEach((key) => {
        entry[key] = row.defects?.[key] ?? 0;
        entry.totalDefects += entry[key];
      });
      return entry;
    })
    .filter((row) => row.totalDefects > 0);

  return { rows, topKeys, keyLabels };
}

export function buildS90dDailyKpiSummary(monthDailySummaries) {
  const activeDays = (monthDailySummaries ?? []).filter((daily) => daily.hasData);
  const totalRow = activeDays.reduce(
    (acc, daily) => {
      acc.totalQty += daily.totalRow?.totalQty ?? 0;
      acc.okQty += daily.totalRow?.okQty ?? 0;
      acc.ngQty += daily.totalRow?.ngQty ?? 0;
      acc.defectTotal += daily.totalRow?.defectTotal ?? 0;
      return acc;
    },
    { totalQty: 0, okQty: 0, ngQty: 0, defectTotal: 0 },
  );

  const yieldPct =
    totalRow.totalQty > 0 ? (totalRow.okQty / totalRow.totalQty) * 100 : 0;
  const ngRatePct =
    totalRow.totalQty > 0 ? (totalRow.ngQty / totalRow.totalQty) * 100 : 0;

  const activeProcesses = new Set();
  activeDays.forEach((daily) => {
    daily.processRows?.forEach((row) => {
      if (row.totalQty > 0) activeProcesses.add(row.process);
    });
  });

  return {
    totalQty: totalRow.totalQty,
    okQty: totalRow.okQty,
    ngQty: totalRow.ngQty,
    yieldPct: Math.round(yieldPct * 10) / 10,
    ngRatePct: Math.round(ngRatePct * 10) / 10,
    defectTotal: totalRow.defectTotal,
    activeDays: activeDays.length,
    activeProcesses: activeProcesses.size,
  };
}

export function buildS90dDailyDefectSummary(monthDailySummaries) {
  const { totalQty, defects } = mergeDailyDefectTotals(monthDailySummaries);
  const defectTotal = Object.values(defects).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    totalRow: {
      totalQty,
      defects,
      defectTotal,
    },
  };
}

export function computeAverageYield(chartRows) {
  const rows = (chartRows ?? []).filter((row) => row.totalQty > 0);
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, row) => acc + (row.yieldPct ?? 0), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}
