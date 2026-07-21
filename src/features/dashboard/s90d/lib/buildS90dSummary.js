import { getISOWeek, parseISO } from "date-fns";
import { barSnapshotToRows } from "../../workplace/lib/barFirebase";
import { normalizeDateKey } from "./s90dDateUtils";
import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  createEmptyDefectCounts,
  mapReasonToDefectKey,
  normalizeS90dProcess,
  sumDefectCounts,
} from "./s90dDefectColumns";
function emptyProcessRow(process) {
  return {
    process,
    classification: process,
    totalQty: 0,
    okQty: 0,
    yieldPct: 0,
    cumulativeYieldPct: 0,
    ngQty: 0,
    ngRatePct: 0,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function sumDefects(defects) {
  return sumDefectCounts(defects);
}
export function filterBarRowsByWeek(rows, weekKey) {
  if (!weekKey) return rows;
  const [weekNum, year] = weekKey.split("_");
  return rows.filter((row) => {
    if (String(row.Week) === weekKey) return true;
    if (!row.time_monthday) return false;
    try {
      const date = parseISO(row.time_monthday);
      return (
        getISOWeek(date).toString() === weekNum &&
        date.getFullYear().toString() === year
      );
    } catch {
      return false;
    }
  });
}

function aggregateBarRows(rows) {
  const byProcess = Object.fromEntries(
    S90D_PROCESSES.map((p) => [p, emptyProcessRow(p)]),
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
  S90D_PROCESSES.forEach((process) => {
    const row = byProcess[process];
    row.yieldPct = pct(row.okQty, row.totalQty);
    if (row.totalQty > 0) {
      cumulative *= row.okQty / row.totalQty;
    }
    row.cumulativeYieldPct = Math.round(cumulative * 1000) / 10;
    row.ngRatePct = pct(row.ngQty, row.totalQty);
    row.defectTotal = sumDefects(row.defects);
  });

  return byProcess;
}

export function ngSnapshotToEntries(ngData) {
  const entries = [];
  if (!ngData || typeof ngData !== "object") return entries;

  for (const workplace of Object.keys(ngData)) {
    const weeks = ngData[workplace];
    if (!weeks || typeof weeks !== "object") continue;
    for (const week of Object.keys(weeks)) {
      const reworks = weeks[week];
      for (const rework of Object.keys(reworks || {})) {
        const days = reworks[rework];
        for (const day of Object.keys(days || {})) {
          const models = days[day];
          for (const model of Object.keys(models || {})) {
            const cell = models[model];
            const payload =
              cell && typeof cell === "object" && "Day" in cell ? cell.Day : cell;
            const quantity =
              typeof payload === "object"
                ? Number(payload?.quantity) || 0
                : Number(payload) || 0;
            const reason =
              typeof payload === "object"
                ? payload?.reason || model
                : model;
            if (quantity <= 0) continue;
            entries.push({
              workplace,
              week,
              day: normalizeDateKey(day),
              quantity,
              reason,
            });
          }
        }
      }
    }
  }
  return entries;
}

export function filterNgEntriesByDate(entries, dateKey) {
  if (!dateKey) return entries;
  return entries.filter((entry) => entry.day === dateKey);
}

export function filterNgEntriesByWeek(entries, weekKey) {
  if (!weekKey) return entries;
  const [weekNum, year] = weekKey.split("_");
  return entries.filter((entry) => {
    if (String(entry.week) === weekKey) return true;
    if (!entry.day) return false;
    try {
      const date = parseISO(entry.day);
      return (
        getISOWeek(date).toString() === weekNum &&
        date.getFullYear().toString() === year
      );
    } catch {
      return false;
    }
  });
}

function applyNgDefects(byProcess, ngEntries) {
  ngEntries.forEach(({ workplace, quantity, reason }) => {
    const process = normalizeS90dProcess(workplace);
    if (!process || !byProcess[process]) return;
    const defectKey = mapReasonToDefectKey(reason);
    if (!defectKey) return;
    byProcess[process].defects[defectKey] += quantity;
  });

  S90D_PROCESSES.forEach((process) => {
    byProcess[process].defectTotal = sumDefects(byProcess[process].defects);
  });
}

function buildTotalRow(processRows) {
  const total = {
    process: "TOTAL",
    classification: "TOTAL",
    isTotal: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: 0,
    cumulativeYieldPct: 0,
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

  total.yieldPct = pct(total.okQty, total.totalQty);
  total.cumulativeYieldPct =
    processRows.length > 0
      ? processRows[processRows.length - 1].cumulativeYieldPct
      : 0;
  total.ngRatePct = pct(total.ngQty, total.totalQty);
  total.defectTotal = sumDefects(total.defects);
  return total;
}

function buildPercentRow(totalRow) {
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

/**
 * @param {{ barData?: object, ngData?: object, weekKey?: string }} params
 */
export function buildS90dSummary({ barData, ngData, weekKey = "" }) {
  const barRows = filterBarRowsByWeek(barSnapshotToRows(barData ?? {}), weekKey);
  const byProcess = aggregateBarRows(barRows);
  const ngEntries = filterNgEntriesByWeek(
    ngSnapshotToEntries(ngData),
    weekKey,
  );
  applyNgDefects(byProcess, ngEntries);

  const processRows = S90D_PROCESSES.map((p) => byProcess[p]);
  const totalRow = buildTotalRow(processRows);
  const percentRow = buildPercentRow(totalRow);

  return {
    processRows,
    totalRow,
    percentRow,
    hasData: processRows.some((r) => r.totalQty > 0),
  };
}

export function listWeekKeysFromBarData(barData) {
  const keys = new Set();
  barSnapshotToRows(barData ?? {}).forEach((row) => {
    if (row.Week) keys.add(String(row.Week));
  });
  return Array.from(keys).sort((a, b) => {
    const [wa, ya] = a.split("_").map(Number);
    const [wb, yb] = b.split("_").map(Number);
    if (ya !== yb) return yb - ya;
    return wb - wa;
  });
}

/** Ô lỗi cần tô hồng khi chiếm ≥ ngưỡng % tổng NG (theo mẫu Excel). */
export function isHighDefectCell(defectQty, totalNgQty) {
  if (!defectQty || !totalNgQty) return false;
  return defectQty / totalNgQty >= 0.15;
}
