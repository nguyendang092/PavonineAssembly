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
import { S90D_SHIFT_SLOTS, normalizeShiftSlot } from "./s90dShiftSlots";
import {
  filterBarRowsByWeek,
  filterNgEntriesByDate,
  filterNgEntriesByWeek,
  ngSnapshotToEntries,
} from "./buildS90dSummary";

const PRODUCT_CODE = "S90D";

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyShiftRow(shiftSlot, process) {
  return {
    shiftSlot,
    process,
    classification: process,
    productCode: PRODUCT_CODE,
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    ngQty: 0,
    ngRatePct: null,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };
}

function aggregateShiftRows(rows, process) {
  const bySlot = Object.fromEntries(
    S90D_SHIFT_SLOTS.map((slot) => [slot, emptyShiftRow(slot, process)]),
  );

  rows.forEach((row) => {
    if (normalizeS90dProcess(row.WorkplaceName) !== process) return;
    const slot = normalizeShiftSlot(row.WorkingLight);
    if (!bySlot[slot]) {
      bySlot[slot] = emptyShiftRow(slot, process);
    }
    const good = Number(row.Total_Good) || 0;
    const ng = Number(row.Total_NG) || 0;
    bySlot[slot].okQty += good;
    bySlot[slot].ngQty += ng;
    bySlot[slot].totalQty += good + ng;
  });

  return S90D_SHIFT_SLOTS.map((slot) => {
    const row = bySlot[slot];
    row.yieldPct = pct(row.okQty, row.totalQty);
    row.ngRatePct = pct(row.ngQty, row.totalQty);
    row.defectTotal = sumDefectCounts(row.defects);
    return row;
  });
}

function applyNgDefectsToTotal(totalRow, ngEntries, process) {
  ngEntries.forEach(({ workplace, quantity, reason }) => {
    if (normalizeS90dProcess(workplace) !== process) return;
    const defectKey = mapReasonToDefectKey(reason);
    if (!defectKey) return;
    totalRow.defects[defectKey] += quantity;
  });
  totalRow.defectTotal = sumDefectCounts(totalRow.defects);
}

function buildShiftTotalRow(process, shiftRows) {
  const total = {
    shiftSlot: "TOTAL",
    process,
    classification: process,
    productCode: PRODUCT_CODE,
    isTotal: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    ngQty: 0,
    ngRatePct: null,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
  };

  shiftRows.forEach((row) => {
    total.totalQty += row.totalQty;
    total.okQty += row.okQty;
    total.ngQty += row.ngQty;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  total.yieldPct = pct(total.okQty, total.totalQty);
  total.ngRatePct = pct(total.ngQty, total.totalQty);
  total.defectTotal = sumDefectCounts(total.defects);
  return total;
}

function buildShiftPercentRow(totalRow) {
  const defects = createEmptyDefectCounts();
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    defects[key] = pct(totalRow.defects[key] ?? 0, totalRow.totalQty) ?? 0;
  });
  return {
    shiftSlot: "PERCENT",
    process: totalRow.process,
    classification: "",
    productCode: "",
    isPercent: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    ngQty: 0,
    ngRatePct: null,
    defects,
    defectTotal: pct(totalRow.defectTotal, totalRow.totalQty) ?? 0,
  };
}

function filterBarRows({ barData, weekKey, dateKey, process }) {
  let rows = barSnapshotToRows(barData ?? {});
  if (weekKey) rows = filterBarRowsByWeek(rows, weekKey);
  if (dateKey) {
    rows = rows.filter(
      (row) => normalizeDateKey(row.time_monthday) === dateKey,
    );
  }
  return rows.filter(
    (row) => normalizeS90dProcess(row.WorkplaceName) === process,
  );
}

function filterNgEntries({ ngData, weekKey, dateKey, process }) {
  let entries = ngSnapshotToEntries(ngData);
  if (weekKey) entries = filterNgEntriesByWeek(entries, weekKey);
  if (dateKey) entries = filterNgEntriesByDate(entries, dateKey);
  return entries.filter(
    (entry) => normalizeS90dProcess(entry.workplace) === process,
  );
}

/**
 * @param {{ process: string, barData?: object, ngData?: object, weekKey?: string, dateKey?: string, dateLabel?: string }} params
 */
export function buildS90dProcessShiftSummary({
  process,
  barData,
  ngData,
  weekKey = "",
  dateKey = "",
  dateLabel = "TOTAL",
}) {
  if (!S90D_PROCESSES.includes(process)) {
    throw new Error(`Unknown S90D process: ${process}`);
  }

  const barRows = filterBarRows({ barData, weekKey, dateKey, process });
  const shiftRows = aggregateShiftRows(barRows, process);
  const ngEntries = filterNgEntries({ ngData, weekKey, dateKey, process });

  const totalRow = buildShiftTotalRow(process, shiftRows);
  applyNgDefectsToTotal(totalRow, ngEntries, process);
  const percentRow = buildShiftPercentRow(totalRow);

  return {
    process,
    dateLabel,
    shiftRows,
    totalRow,
    percentRow,
    hasData: shiftRows.some((r) => r.totalQty > 0) || totalRow.ngQty > 0,
  };
}

export function buildS90dAllProcessShiftSummaries(params) {
  return S90D_PROCESSES.map((process) =>
    buildS90dProcessShiftSummary({ ...params, process }),
  );
}
