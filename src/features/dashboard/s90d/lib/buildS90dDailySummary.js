import { barSnapshotToRows } from "../../workplace/lib/barFirebase";
import {
  formatS90dDailyDateLabel,
  listCurrentMonthDateKeys,
  normalizeDateKey,
} from "./s90dDateUtils";
import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  createEmptyDefectCounts,
  mapReasonToDefectKey,
  normalizeS90dProcess,
  sumDefectCounts,
} from "./s90dDefectColumns";
import {
  filterBarRowsByWeek,
  filterNgEntriesByDate,
  ngSnapshotToEntries,
} from "./buildS90dSummary";

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyDailyProcessRow(process) {
  return {
    process,
    classification: process,
    totalQty: 0,
    okQty: 0,
    yieldPct: 0,
    cumulativeYieldPct: null,
    ngQty: 0,
    ngRatePct: 0,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };
}

function aggregateDailyRows(rows) {
  const byProcess = Object.fromEntries(
    S90D_PROCESSES.map((p) => [p, emptyDailyProcessRow(p)]),
  );

  rows.forEach((row) => {
    const process = normalizeS90dProcess(row.WorkplaceName);
    if (!process || !byProcess[process]) return;
    const good = Number(row.Total_Good) || 0;
    const ng = Number(row.Total_NG) || 0;
    byProcess[process].okQty += good;
    byProcess[process].ngQty += ng;
    byProcess[process].totalQty += good + ng;
  });

  let cumulative = 1;
  S90D_PROCESSES.forEach((process, index) => {
    const row = byProcess[process];
    row.yieldPct = pct(row.okQty, row.totalQty);
    if (row.totalQty > 0) {
      cumulative *= row.okQty / row.totalQty;
      row.cumulativeYieldPct =
        index === 0 ? null : Math.round(cumulative * 1000) / 10;
    } else {
      row.cumulativeYieldPct = null;
    }
    row.ngRatePct = pct(row.ngQty, row.totalQty);
    row.defectTotal = sumDefectCounts(row.defects);
  });

  return S90D_PROCESSES.map((p) => byProcess[p]);
}

function applyDailyNgDefects(processRows, ngEntries) {
  const byProcess = Object.fromEntries(processRows.map((row) => [row.process, row]));

  ngEntries.forEach(({ workplace, quantity, reason }) => {
    const process = normalizeS90dProcess(workplace);
    if (!process || !byProcess[process]) return;
    const defectKey = mapReasonToDefectKey(reason);
    if (!defectKey) return;
    byProcess[process].defects[defectKey] += quantity;
  });

  processRows.forEach((row) => {
    row.defectTotal = sumDefectCounts(row.defects);
  });
}

function buildDailyTotalRow(processRows) {
  const total = {
    process: "TOTAL",
    classification: "TOTAL",
    isTotal: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    cumulativeYieldPct: null,
    ngQty: 0,
    ngRatePct: 0,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };

  processRows.forEach((row) => {
    total.totalQty += row.totalQty;
    total.okQty += row.okQty;
    total.ngQty += row.ngQty;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  total.yieldPct = total.totalQty ? pct(total.okQty, total.totalQty) : null;
  const lastWithCumul = [...processRows]
    .reverse()
    .find((r) => r.cumulativeYieldPct != null);
  total.cumulativeYieldPct = lastWithCumul?.cumulativeYieldPct ?? null;
  total.ngRatePct = pct(total.ngQty, total.totalQty);
  total.defectTotal = sumDefectCounts(total.defects);
  return total;
}

function buildDailyPercentRow(totalRow) {
  const defects = createEmptyDefectCounts();
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    defects[key] = pct(totalRow.defects[key] ?? 0, totalRow.totalQty);
  });
  return {
    process: "PERCENT",
    classification: "",
    isPercent: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: 0,
    cumulativeYieldPct: 0,
    ngQty: 0,
    ngRatePct: 0,
    defects,
    defectTotal: pct(totalRow.defectTotal, totalRow.totalQty),
  };
}

export function buildEmptyDailySummary(dateKey) {
  const processRows = S90D_PROCESSES.map((process) =>
    emptyDailyProcessRow(process),
  );
  const totalRow = buildDailyTotalRow(processRows);
  const percentRow = buildDailyPercentRow(totalRow);

  return {
    dateKey,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    processRows,
    totalRow,
    percentRow,
    hasData: false,
  };
}

/**
 * @param {{ barData?: object, ngData?: object, dateKey?: string, weekKey?: string }} params
 */
export function buildS90dDailySummary({
  barData,
  ngData,
  dateKey = "",
  weekKey = "",
}) {
  let barRows = barSnapshotToRows(barData ?? {});
  if (weekKey) {
    barRows = filterBarRowsByWeek(barRows, weekKey);
  }

  const dayRows = barRows.filter(
    (row) => normalizeDateKey(row.time_monthday) === dateKey,
  );
  const processRows = aggregateDailyRows(dayRows);
  const ngEntries = filterNgEntriesByDate(
    ngSnapshotToEntries(ngData),
    dateKey,
  );
  applyDailyNgDefects(processRows, ngEntries);

  const totalRow = buildDailyTotalRow(processRows);
  const percentRow = buildDailyPercentRow(totalRow);

  return {
    dateKey,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    processRows,
    totalRow,
    percentRow,
    hasData: processRows.some((r) => r.totalQty > 0),
  };
}

export function buildS90dMonthDailySummaries({
  barData,
  ngData,
  referenceDate = new Date(),
}) {
  return listCurrentMonthDateKeys(referenceDate).map((dateKey) =>
    buildS90dDailySummary({ barData, ngData, dateKey }),
  );
}

export {
  formatS90dDailyDateLabel,
  formatS90dMonthLabel,
  listCurrentMonthDateKeys,
} from "./s90dDateUtils";

export function formatS90dDailyQty(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export function formatS90dDailyPct(value) {
  if (value == null || value === "") return "";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

export function formatS90dDailyNg(value) {
  const n = Number(value) || 0;
  return n > 0 ? n.toLocaleString("vi-VN") : "-";
}

export function formatS90dDefectQty(value, isPercentRow) {
  if (isPercentRow) {
    return value > 0 ? `${value}%` : "0%";
  }
  const n = Number(value) || 0;
  return n > 0 ? n.toLocaleString("vi-VN") : "-";
}
