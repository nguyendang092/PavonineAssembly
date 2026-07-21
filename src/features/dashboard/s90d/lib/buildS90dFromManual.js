import { getISOWeek, parseISO } from "date-fns";
import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  createEmptyDefectCounts,
  sumDefectCounts,
} from "./s90dDefectColumns";
import { formatS90dDailyDateLabel } from "./s90dDateUtils";
import { DEFAULT_PRODUCT_CODE, resolveProcessBoards } from "./s90dManualEntries";
import {
  collectDefectImageLists,
  createEmptyDefectImageLists,
  normalizeDefectImageUrls,
} from "./s90dDefectImages";
import { S90D_SHIFT_SLOTS } from "./s90dShiftSlots";

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function pctOrZero(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyGrandProcessRow(process) {
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
    defectImages: createEmptyDefectImageLists(),
  };
}

function buildShiftRow(shiftSlot, process, productCode, shiftEntry) {
  const okQty = shiftEntry.okQty ?? 0;
  const defects = { ...createEmptyDefectCounts(), ...shiftEntry.defects };
  const ngQty = sumDefectCounts(defects);
  const totalQty = okQty + ngQty;
  const defectImages = normalizeDefectImageUrls(shiftEntry.defectImages);

  return {
    shiftSlot,
    process,
    classification: process,
    productCode,
    totalQty,
    okQty,
    yieldPct: pct(okQty, totalQty),
    ngQty,
    ngRatePct: pct(ngQty, totalQty),
    defects,
    defectTotal: sumDefectCounts(defects),
    defectImages,
  };
}

function buildShiftTotalRow(process, productCode, shiftRows) {
  const total = {
    shiftSlot: "TOTAL",
    process,
    classification: process,
    productCode,
    isTotal: true,
    totalQty: 0,
    okQty: 0,
    yieldPct: null,
    ngQty: 0,
    ngRatePct: null,
    defects: createEmptyDefectCounts(),
    defectTotal: 0,
    defectImages: createEmptyDefectImageLists(),
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
  total.defectImages = collectDefectImageLists(shiftRows);
  return total;
}

function buildShiftPercentRow(totalRow) {
  const defects = createEmptyDefectCounts();
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    defects[key] = pctOrZero(totalRow.defects[key] ?? 0, totalRow.totalQty);
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
    defectTotal: pctOrZero(totalRow.defectTotal, totalRow.totalQty),
  };
}

function sumShiftEntries(entries) {
  const merged = {
    okQty: 0,
    ngQty: 0,
    defects: createEmptyDefectCounts(),
    defectImages: createEmptyDefectImageUrls(),
  };

  entries.forEach((entry) => {
    merged.okQty += entry.okQty ?? 0;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      merged.defects[key] += entry.defects?.[key] ?? 0;
    });
  });

  merged.ngQty = sumDefectCounts(merged.defects);

  const imageLists = collectDefectImageLists(entries);
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    merged.defectImages[key] = imageLists[key][0] ?? "";
  });

  return merged;
}

export function dateKeyInWeek(dateKey, weekKey) {
  if (!weekKey) return true;
  const [weekNum, year] = weekKey.split("_");
  try {
    const date = parseISO(dateKey);
    return (
      getISOWeek(date).toString() === weekNum &&
      date.getFullYear().toString() === year
    );
  } catch {
    return false;
  }
}

export function buildProcessShiftSummaryFromManual({
  dayEntry,
  process,
  boardEntry,
  dateLabel = "TOTAL",
}) {
  const entry =
    boardEntry ??
    resolveProcessBoards(dayEntry?.[process])[0] ??
    { productCode: DEFAULT_PRODUCT_CODE, shifts: {} };
  const productCode = entry?.productCode || DEFAULT_PRODUCT_CODE;
  const shiftRows = S90D_SHIFT_SLOTS.map((slot) =>
    buildShiftRow(
      slot,
      process,
      productCode,
      entry?.shifts?.[slot] ?? { okQty: 0, ngQty: 0, defects: {} },
    ),
  );
  const totalRow = buildShiftTotalRow(process, productCode, shiftRows);
  const percentRow = buildShiftPercentRow(totalRow);

  return {
    process,
    dateLabel,
    shiftRows,
    totalRow,
    percentRow,
    hasData: shiftRows.some((row) => row.totalQty > 0),
  };
}

function mergeProcessBoardSummariesToProcessRow(summaries, process) {
  const merged = {
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
    defectImages: createEmptyDefectImageLists(),
  };

  summaries.forEach((summary) => {
    const total = summary.totalRow;
    merged.totalQty += total.totalQty;
    merged.okQty += total.okQty;
    merged.ngQty += total.ngQty;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      merged.defects[key] += total.defects[key] ?? 0;
    });
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      const urls = total.defectImages?.[key] ?? [];
      urls.forEach((url) => {
        if (url && !merged.defectImages[key].includes(url)) {
          merged.defectImages[key].push(url);
        }
      });
    });
  });

  merged.yieldPct = pctOrZero(merged.okQty, merged.totalQty);
  merged.ngRatePct = pctOrZero(merged.ngQty, merged.totalQty);
  merged.defectTotal = sumDefectCounts(merged.defects);
  return merged;
}

export function buildProcessDayAggregateSummaryFromManual({
  dayEntry,
  process,
  dateLabel = "TOTAL",
}) {
  const boards = resolveProcessBoards(dayEntry?.[process]);
  const summaries = boards.map((board) =>
    buildProcessShiftSummaryFromManual({
      boardEntry: board,
      process,
      dateLabel,
    }),
  );

  const processRow = mergeProcessBoardSummariesToProcessRow(summaries, process);
  return {
    process,
    dateLabel,
    boards,
    summaries,
    processRow,
    hasData: summaries.some((summary) => summary.hasData),
  };
}

export function buildWeekProcessShiftSummaryFromManual({
  store,
  process,
  dateKeys,
  weekKey,
  dateLabel = "TOTAL",
}) {
  const filteredKeys = dateKeys.filter((dateKey) =>
    dateKeyInWeek(dateKey, weekKey),
  );
  const mergedBySlot = Object.fromEntries(
    S90D_SHIFT_SLOTS.map((slot) => [slot, []]),
  );
  let productCode = DEFAULT_PRODUCT_CODE;

  filteredKeys.forEach((dateKey) => {
    const boards = resolveProcessBoards(store[dateKey]?.[process]);
    boards.forEach((board) => {
      if (board?.productCode) {
        productCode = board.productCode;
      }
      S90D_SHIFT_SLOTS.forEach((slot) => {
        mergedBySlot[slot].push(board?.shifts?.[slot] ?? { okQty: 0, ngQty: 0, defects: {} });
      });
    });
  });

  const shiftRows = S90D_SHIFT_SLOTS.map((slot) =>
    buildShiftRow(slot, process, productCode, sumShiftEntries(mergedBySlot[slot])),
  );
  const totalRow = buildShiftTotalRow(process, productCode, shiftRows);
  const percentRow = buildShiftPercentRow(totalRow);

  return {
    process,
    dateLabel,
    shiftRows,
    totalRow,
    percentRow,
    hasData: shiftRows.some((row) => row.totalQty > 0),
  };
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
    defectImages: createEmptyDefectImageLists(),
  };

  processRows.forEach((row) => {
    total.totalQty += row.totalQty;
    total.okQty += row.okQty;
    total.ngQty += row.ngQty;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  total.yieldPct = total.totalQty ? pctOrZero(total.okQty, total.totalQty) : null;
  const lastWithCumul = [...processRows]
    .reverse()
    .find((row) => row.cumulativeYieldPct != null);
  total.cumulativeYieldPct = lastWithCumul?.cumulativeYieldPct ?? null;
  total.ngRatePct = pctOrZero(total.ngQty, total.totalQty);
  total.defectTotal = sumDefectCounts(total.defects);
  total.defectImages = collectDefectImageLists(processRows);
  return total;
}

function buildDailyPercentRow(totalRow) {
  const defects = createEmptyDefectCounts();
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    defects[key] = pctOrZero(totalRow.defects[key] ?? 0, totalRow.totalQty);
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
    defectTotal: pctOrZero(totalRow.defectTotal, totalRow.totalQty),
  };
}

export function buildDailySummaryFromManual({ dayEntry, dateKey }) {
  const processRows = S90D_PROCESSES.map((process) => {
    const aggregate = buildProcessDayAggregateSummaryFromManual({
      dayEntry,
      process,
      dateLabel: formatS90dDailyDateLabel(dateKey),
    });
    return aggregate.processRow;
  });

  let cumulative = 1;
  processRows.forEach((row, index) => {
    if (row.totalQty > 0) {
      cumulative *= row.okQty / row.totalQty;
      row.cumulativeYieldPct =
        index === 0 ? null : Math.round(cumulative * 1000) / 10;
    }
  });

  const totalRow = buildDailyTotalRow(processRows);
  const percentRow = buildDailyPercentRow(totalRow);

  return {
    dateKey,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    processRows,
    totalRow,
    percentRow,
    hasData: processRows.some((row) => row.totalQty > 0),
  };
}

export function buildMonthDailySummariesFromManual({ store, dateKeys }) {
  return dateKeys.map((dateKey) =>
    buildDailySummaryFromManual({
      dayEntry: store[dateKey],
      dateKey,
    }),
  );
}

function buildGrandTotalRow(processRows) {
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
    defectImages: createEmptyDefectImageLists(),
  };

  processRows.forEach((row) => {
    total.totalQty += row.totalQty;
    total.okQty += row.okQty;
    total.ngQty += row.ngQty;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  total.yieldPct = pctOrZero(total.okQty, total.totalQty);
  total.cumulativeYieldPct =
    processRows.length > 0
      ? processRows[processRows.length - 1].cumulativeYieldPct ?? 0
      : 0;
  total.ngRatePct = pctOrZero(total.ngQty, total.totalQty);
  total.defectTotal = sumDefectCounts(total.defects);
  total.defectImages = collectDefectImageLists(processRows);
  return total;
}

function buildGrandPercentRow(totalRow) {
  const defects = createEmptyDefectCounts();
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    defects[key] = pctOrZero(totalRow.defects[key] ?? 0, totalRow.totalQty);
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
    defectTotal: pctOrZero(totalRow.defectTotal, totalRow.totalQty),
  };
}

export function buildGrandTotalSummaryFromManual(dailySummaries) {
  const byProcess = Object.fromEntries(
    S90D_PROCESSES.map((process) => [process, emptyGrandProcessRow(process)]),
  );

  dailySummaries.forEach((daily) => {
    daily.processRows.forEach((row) => {
      const target = byProcess[row.process];
      target.totalQty += row.totalQty;
      target.okQty += row.okQty;
      target.ngQty += row.ngQty;
      S90D_DEFECT_COLUMNS.forEach(({ key }) => {
        target.defects[key] += row.defects[key] ?? 0;
        row.defectImages?.[key]?.forEach((url) => {
          if (url && !target.defectImages[key].includes(url)) {
            target.defectImages[key].push(url);
          }
        });
      });
    });
  });

  let cumulative = 1;
  const processRows = S90D_PROCESSES.map((process) => {
    const row = byProcess[process];
    row.yieldPct = pctOrZero(row.okQty, row.totalQty);
    if (row.totalQty > 0) {
      cumulative *= row.okQty / row.totalQty;
    }
    row.cumulativeYieldPct = Math.round(cumulative * 1000) / 10;
    row.ngRatePct = pctOrZero(row.ngQty, row.totalQty);
    row.defectTotal = sumDefectCounts(row.defects);
    return row;
  });

  const totalRow = buildGrandTotalRow(processRows);
  const percentRow = buildGrandPercentRow(totalRow);

  return {
    processRows,
    totalRow,
    percentRow,
    hasData: processRows.some((row) => row.totalQty > 0),
  };
}
