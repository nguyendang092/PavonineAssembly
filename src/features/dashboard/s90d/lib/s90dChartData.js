import { format, parseISO } from "date-fns";
import { applyS90dProcessYieldMetrics, roundYieldPct } from "./s90dCumulativeYield";
import { S90D_DEFECT_COLUMNS, S90D_PROCESSES } from "./s90dDefectColumns";
import {
  findBoardRowForProduct,
  isProductProcessChainComplete,
  normalizeProductCode,
} from "./s90dProcessChain";

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

/** Hiệu suất hiển thị trên biểu đồ — ưu tiên công đoạn cuối (ASSEMBLY), giới hạn 0–100%. */
export function resolveS90dChartYieldPct(row) {
  if (!row) return 0;
  const raw =
    row.yieldPct ??
    row.cumulativeYieldPct ??
    (row.totalQty > 0 ? (row.okQty / row.totalQty) * 100 : null);
  return roundYieldPct(raw) ?? 0;
}

export function buildS90dChartKpiSummary(summary) {
  const totalRow = summary?.totalRow ?? {};
  const chartYieldPct = resolveS90dChartYieldPct(totalRow);
  return {
    totalQty: totalRow.totalQty ?? 0,
    okQty: totalRow.okQty ?? 0,
    ngQty: totalRow.ngQty ?? 0,
    yieldPct: chartYieldPct,
    cumulativeYieldPct: chartYieldPct,
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
    yieldPct: roundYieldPct(row.yieldPct) ?? 0,
    ngRatePct: row.ngRatePct ?? 0,
    cumulativeYieldPct: roundYieldPct(row.cumulativeYieldPct) ?? 0,
  }));
}

export function buildS90dYieldComparisonData(summary, processLabelFn) {
  return buildS90dTotalProcessChartData(summary, processLabelFn).filter(
    (row) => row.totalQty > 0,
  );
}

function pctFromQty(okQty, totalQty) {
  if (!totalQty) return null;
  return roundYieldPct((okQty / totalQty) * 100);
}

function resolveBoardYield(boardRow) {
  const totalQty = Number(boardRow?.totalQty ?? 0);
  const okQty = Number(boardRow?.okQty ?? 0);
  if (totalQty <= 0) {
    return { totalQty: 0, okQty: 0, yieldPct: null, ngRatePct: null };
  }

  const yieldPct =
    boardRow?.yieldPct != null
      ? roundYieldPct(Number(boardRow.yieldPct))
      : pctFromQty(okQty, totalQty);
  const ngRatePct =
    boardRow?.ngRatePct != null
      ? Number(boardRow.ngRatePct)
      : pctFromQty(Number(boardRow?.ngQty ?? 0), totalQty);

  return { totalQty, okQty, yieldPct, ngRatePct };
}

/** Hiệu suất theo mã hàng — chỉ hợp lệ khi đủ SL ở mọi công đoạn (PRESS → MC → … → ASSEMBLY). */
export function buildProductCodeYieldItems(
  processDetails = [],
  {
    boardSpecs = null,
    processes = S90D_PROCESSES,
    requireFullProcessChain = false,
    usesProductSubCodes = false,
  } = {},
) {
  // S90D: không hiển thị ring INZI/MXC Type D/E trên biểu đồ — dùng hiệu suất tổng.
  if (usesProductSubCodes) {
    return [];
  }

  const specs = Array.isArray(boardSpecs) && boardSpecs.length >= 2 ? boardSpecs : null;
  if (!specs || !Array.isArray(processDetails) || !processDetails.length) {
    return [];
  }

  const outputProcess = processes[processes.length - 1] ?? "ASSEMBLY";

  return specs.map((spec) => {
    const productCode = String(spec.productCode ?? spec.label ?? "").trim();
    const codeKey = normalizeProductCode(productCode);

    const pseudoProcessRows = processes.map((process) => {
      const detail = processDetails.find((item) => item.process === process);
      const boardRow = findBoardRowForProduct(detail, codeKey);
      const metrics = resolveBoardYield(boardRow);
      return {
        process,
        totalQty: metrics.totalQty,
        okQty: metrics.okQty,
        yieldPct: metrics.yieldPct,
        cumulativeYieldPct: null,
      };
    });

    const outputDetail = processDetails.find(
      (item) => item.process === outputProcess,
    );
    const outputBoard =
      findBoardRowForProduct(outputDetail, codeKey) ??
      [...processDetails]
        .reverse()
        .flatMap((detail) => detail.boardRows ?? [])
        .find(
          (row) =>
            normalizeProductCode(row.productCode ?? row.label) === codeKey,
        ) ??
      null;
    const outputMetrics = resolveBoardYield(outputBoard);

    const chainComplete = requireFullProcessChain
      ? isProductProcessChainComplete(pseudoProcessRows, processes)
      : pseudoProcessRows.some((row) => row.totalQty > 0);

    const activeProcessRows = pseudoProcessRows.filter((row) => row.totalQty > 0);
    applyS90dProcessYieldMetrics(activeProcessRows, { emptyAsNull: false });
    const lastActiveProcess =
      activeProcessRows[activeProcessRows.length - 1] ?? null;

    const stageYieldPct = chainComplete
      ? roundYieldPct(outputMetrics.yieldPct)
      : null;
    const cumulativeYieldPct = chainComplete
      ? roundYieldPct(lastActiveProcess?.cumulativeYieldPct ?? stageYieldPct)
      : null;

    return {
      productCode,
      label: String(spec.label ?? productCode).trim() || productCode,
      totalQty: outputMetrics.totalQty,
      okQty: outputMetrics.okQty,
      yieldPct: cumulativeYieldPct ?? stageYieldPct,
      cumulativeYieldPct,
      ngRatePct: chainComplete ? outputMetrics.ngRatePct ?? null : null,
      hasData: outputMetrics.totalQty > 0,
      isValid: chainComplete && outputMetrics.totalQty > 0,
    };
  });
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
      yieldPct: resolveS90dChartYieldPct(daily.totalRow),
      cumulativeYieldPct: roundYieldPct(daily.totalRow?.cumulativeYieldPct) ?? 0,
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

  let yieldWeightedSum = 0;
  let yieldWeightQty = 0;

  activeDays.forEach((daily) => {
    const outputQty = daily.totalRow?.totalQty ?? 0;
    if (outputQty <= 0) return;
    yieldWeightedSum += resolveS90dChartYieldPct(daily.totalRow) * outputQty;
    yieldWeightQty += outputQty;
  });

  const yieldPct =
    yieldWeightQty > 0
      ? roundYieldPct(yieldWeightedSum / yieldWeightQty) ?? 0
      : 0;
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
    yieldPct,
    cumulativeYieldPct: yieldPct,
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
  const sum = rows.reduce(
    (acc, row) => acc + resolveS90dChartYieldPct(row),
    0,
  );
  return roundYieldPct(sum / rows.length) ?? 0;
}
