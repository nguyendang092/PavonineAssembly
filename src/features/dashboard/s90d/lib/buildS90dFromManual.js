import { getISOWeek, parseISO } from "date-fns";
import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  createEmptyDefectCounts,
  sumDefectCounts,
} from "./s90dDefectColumns";
import { AP5_DEFAULT_PRODUCT_CODE } from "./s90dManualEntryReportConfig";
import {
  inferCodeSlotFromBoardId,
  shouldShowProductBoardRows,
} from "./s90dEntryBoardSpecs";
import { formatS90dDailyDateLabel } from "./s90dDateUtils";
import { DEFAULT_PRODUCT_CODE, resolveProcessBoards } from "./s90dManualEntries";
import {
  resolveManualEntryConfig,
} from "./s90dManualEntryReportConfig";
import {
  collectDefectImageLists,
  createEmptyDefectImageLists,
  normalizeDefectImageUrls,
} from "./s90dDefectImages";
import {
  applyS90dProcessYieldMetrics,
  applyS90dReportYieldMetrics,
  roundYieldPct,
} from "./s90dCumulativeYield";
import {
  applyBrokenChainBoardYieldInvalidation,
  applyBrokenChainYieldInvalidation,
  findBoardRowForProduct,
  findMergedBoardRowForProduct,
  isS90dProcessChainComplete,
  normalizeProductCode,
} from "./s90dProcessChain";
import { S90D_SHIFT_SLOTS } from "./s90dShiftSlots";

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function yieldPctFromQty(numerator, denominator) {
  if (!denominator) return null;
  return roundYieldPct((numerator / denominator) * 100);
}

function yieldPctOrZero(numerator, denominator) {
  if (!denominator) return 0;
  return roundYieldPct((numerator / denominator) * 100) ?? 0;
}

function pctOrZero(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function resolveProductCodeFromDayEntry(
  dayEntry,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);
  let placeholder = "";

  for (const process of config.processes) {
    for (const board of resolveProcessBoards(dayEntry?.[process], process, config)) {
      const code = String(board?.productCode ?? "").trim();
      if (!code) continue;
      if (
        config.defaultProductCode === AP5_DEFAULT_PRODUCT_CODE ||
        code !== config.defaultProductCode ||
        config.defaultProductCode === DEFAULT_PRODUCT_CODE
      ) {
        if (config.defaultProductCode === AP5_DEFAULT_PRODUCT_CODE) {
          return AP5_DEFAULT_PRODUCT_CODE;
        }
        return code;
      }
      placeholder = code;
    }
  }

  return config.defaultProductCode || placeholder || DEFAULT_PRODUCT_CODE;
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

function buildShiftRow(
  shiftSlot,
  process,
  productCode,
  shiftEntry,
  { codeSlot = null } = {},
) {
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
    codeSlot,
    totalQty,
    okQty,
    yieldPct: yieldPctFromQty(okQty, totalQty),
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

  total.yieldPct = yieldPctFromQty(total.okQty, total.totalQty);
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
  const codeSlot =
    entry?.codeSlot === "D" || entry?.codeSlot === "E" ? entry.codeSlot : null;
  const shiftRows = S90D_SHIFT_SLOTS.map((slot) =>
    buildShiftRow(
      slot,
      process,
      productCode,
      entry?.shifts?.[slot] ?? { okQty: 0, ngQty: 0, defects: {} },
      { codeSlot },
    ),
  );
  const totalRow = buildShiftTotalRow(process, productCode, shiftRows);
  const percentRow = buildShiftPercentRow(totalRow);

  return {
    process,
    dateLabel,
    codeSlot,
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

  merged.yieldPct = merged.totalQty
    ? yieldPctOrZero(merged.okQty, merged.totalQty)
    : null;
  merged.ngRatePct = merged.totalQty
    ? pctOrZero(merged.ngQty, merged.totalQty)
    : null;
  merged.defectTotal = sumDefectCounts(merged.defects);
  return merged;
}

function buildDisplayBoardRowsFromAggregate(aggregate, process, config) {
  if (!shouldShowProductBoardRows(process, config)) {
    return [];
  }

  if (aggregate.boards.length < 2) return [];

  return aggregate.summaries.map((summary, index) => {
    const board = aggregate.boards[index];
    const productCode =
      String(
        summary.totalRow.productCode ||
          board?.productCode ||
          board?.label ||
          "",
      ).trim() || DEFAULT_PRODUCT_CODE;
    const codeSlot =
      board?.codeSlot === "D" || board?.codeSlot === "E"
        ? board.codeSlot
        : inferCodeSlotFromBoardId(board?.id);

    return {
      boardId: board?.id ?? `board-${index}`,
      label: board?.label ?? `Bảng ${index + 1}`,
      productCode,
      codeSlot: codeSlot ?? null,
      totalQty: summary.totalRow.totalQty,
      okQty: summary.totalRow.okQty,
      yieldPct: summary.totalRow.yieldPct,
      ngQty: summary.totalRow.ngQty,
      ngRatePct: summary.totalRow.ngRatePct,
      defects: summary.totalRow.defects,
      defectTotal: summary.totalRow.defectTotal,
      hasData: summary.hasData,
    };
  });
}

export function buildProcessDayAggregateSummaryFromManual({
  dayEntry,
  process,
  dateLabel = "TOTAL",
  manualEntryConfig,
  defaultProductCode,
}) {
  const config = resolveManualEntryConfig(manualEntryConfig ?? defaultProductCode);
  const boards = resolveProcessBoards(dayEntry?.[process], process, config);
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
    const boards = resolveProcessBoards(store[dateKey]?.[process], process);
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

function resolveOutputProcessRow(processRows, outputProcess) {
  if (outputProcess) {
    const matched = processRows.find((row) => row.process === outputProcess);
    if (matched?.totalQty > 0) return matched;
  }
  return (
    [...processRows].reverse().find((row) => row.totalQty > 0) ?? null
  );
}

function resolveFinalProcessRow(processRows, outputProcess, processes = []) {
  if (outputProcess) {
    const matched = processRows.find((row) => row.process === outputProcess);
    if (matched) return matched;
  }
  const lastProcess = processes[processes.length - 1];
  if (lastProcess) {
    const matched = processRows.find((row) => row.process === lastProcess);
    if (matched) return matched;
  }
  return resolveOutputProcessRow(processRows, outputProcess);
}

function buildDailyTotalRow(
  processRows,
  { outputProcessOnly = false, outputProcess = null, processes = [] } = {},
) {
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
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  if (outputProcessOnly) {
    const outputRow = resolveOutputProcessRow(processRows, outputProcess);
    const chainComplete = isS90dProcessChainComplete(processRows, processes);
    if (outputRow) {
      total.totalQty = outputRow.totalQty;
      total.okQty = outputRow.okQty;
      total.ngQty = outputRow.ngQty;
      total.yieldPct = chainComplete ? outputRow.yieldPct : null;
      total.cumulativeYieldPct = chainComplete
        ? outputRow.cumulativeYieldPct
        : null;
      total.ngRatePct = chainComplete ? outputRow.ngRatePct : null;
    }
  } else {
    processRows.forEach((row) => {
      total.totalQty += row.totalQty;
      total.okQty += row.okQty;
      total.ngQty += row.ngQty;
    });

    const finalProcessRow = resolveFinalProcessRow(
      processRows,
      outputProcess,
      processes,
    );
    total.yieldPct = total.totalQty
      ? yieldPctOrZero(total.okQty, total.totalQty)
      : null;
    total.cumulativeYieldPct = finalProcessRow?.cumulativeYieldPct ?? null;
    total.ngRatePct = pctOrZero(total.ngQty, total.totalQty);
  }

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

export function buildDailySummaryFromManual({
  dayEntry,
  dateKey,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  manualEntryConfig,
}) {
  const config = resolveManualEntryConfig(manualEntryConfig ?? defaultProductCode);
  const productCode = resolveProductCodeFromDayEntry(dayEntry, config);
  const processDetails = config.processes.map((process) => {
    const aggregate = buildProcessDayAggregateSummaryFromManual({
      dayEntry,
      process,
      dateLabel: formatS90dDailyDateLabel(dateKey),
      manualEntryConfig: config,
    });

    const boardRows = buildDisplayBoardRowsFromAggregate(aggregate, process, config);

    return {
      process,
      processRow: aggregate.processRow,
      boardRows,
      boardCount: boardRows.length || aggregate.boards.length,
    };
  });

  const processRows = processDetails.map((detail) => detail.processRow);

  applyS90dReportYieldMetrics(
    {
      processDetails,
      processRows,
      processes: config.processes,
      usesProductSubCodes: config.usesProductSubCodes,
      fixedBoardSpecsAllProcesses: config.fixedBoardSpecsAllProcesses,
      fixedBoardSpecs: config.fixedBoardSpecs,
    },
    { emptyAsNull: true },
  );

  if (config.fixedBoardSpecsAllProcesses) {
    applyBrokenChainYieldInvalidation(processRows, config.processes);
    applyBrokenChainBoardYieldInvalidation(processDetails, config.processes);
  }

  const outputProcess = config.processes[config.processes.length - 1];
  const totalRow = buildDailyTotalRow(processRows, {
    outputProcessOnly: config.fixedBoardSpecsAllProcesses,
    outputProcess,
    processes: config.processes,
  });
  const percentRow = buildDailyPercentRow(totalRow);

  return {
    dateKey,
    dateLabel: formatS90dDailyDateLabel(dateKey),
    productCode,
    processRows,
    processDetails,
    totalRow,
    percentRow,
    hasData: processRows.some((row) => row.totalQty > 0),
  };
}

export function buildMonthDailySummariesFromManual({
  store,
  dateKeys,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  manualEntryConfig,
}) {
  const config = resolveManualEntryConfig(manualEntryConfig ?? defaultProductCode);
  return dateKeys.map((dateKey) =>
    buildDailySummaryFromManual({
      dayEntry: store[dateKey],
      dateKey,
      defaultProductCode: config.defaultProductCode,
      manualEntryConfig: config,
    }),
  );
}

function boardRowToProcessRow(process, boardRow) {
  if (!boardRow) return emptyGrandProcessRow(process);

  return {
    process,
    classification: process,
    totalQty: boardRow.totalQty ?? 0,
    okQty: boardRow.okQty ?? 0,
    ngQty: boardRow.ngQty ?? 0,
    yieldPct: boardRow.yieldPct ?? null,
    cumulativeYieldPct: boardRow.cumulativeYieldPct ?? null,
    ngRatePct: boardRow.ngRatePct ?? null,
    defects: {
      ...createEmptyDefectCounts(),
      ...(boardRow.defects ?? {}),
    },
    defectTotal:
      boardRow.defectTotal ?? sumDefectCounts(boardRow.defects ?? {}),
    defectImages: boardRow.defectImages ?? createEmptyDefectImageLists(),
  };
}

/** Lọc báo cáo ngày theo một mã AP5 (AP5FF / AP5FZ / AP5FL). */
export function buildProductScopedDailySummary(
  dailySummary,
  productCode,
  manualEntryConfig,
) {
  if (!dailySummary || !productCode) return dailySummary;

  const config = resolveManualEntryConfig(manualEntryConfig);
  const codeKey = normalizeProductCode(productCode);
  const processes = config.processes;

  const processDetails = processes.map((process) => {
    const detail = dailySummary.processDetails?.find(
      (item) => item.process === process,
    );
    const boardRow = findMergedBoardRowForProduct(detail, codeKey);

    return {
      process,
      processRow: boardRowToProcessRow(process, boardRow),
      boardRows: [],
      boardCount: boardRow ? 1 : 0,
    };
  });

  const processRows = processDetails.map((detail) => detail.processRow);

  applyS90dReportYieldMetrics(
    {
      processDetails,
      processRows,
      processes,
      usesProductSubCodes: config.usesProductSubCodes,
      fixedBoardSpecsAllProcesses: config.fixedBoardSpecsAllProcesses,
      fixedBoardSpecs: config.fixedBoardSpecs,
    },
    { emptyAsNull: true },
  );

  if (config.fixedBoardSpecsAllProcesses) {
    applyBrokenChainYieldInvalidation(processRows, processes);
    applyBrokenChainBoardYieldInvalidation(processDetails, processes);
  }

  const outputProcess = processes[processes.length - 1];
  const totalRow = buildDailyTotalRow(processRows, {
    outputProcessOnly: config.fixedBoardSpecsAllProcesses,
    outputProcess,
    processes: config.processes,
  });
  const percentRow = buildDailyPercentRow(totalRow);

  return {
    ...dailySummary,
    productCode: codeKey,
    processRows,
    processDetails,
    totalRow,
    percentRow,
    hasData: processRows.some((row) => row.totalQty > 0),
  };
}

export function buildProductScopedMonthDailySummaries(
  monthDailySummaries,
  productCode,
  manualEntryConfig,
) {
  return (monthDailySummaries ?? []).map((daily) =>
    buildProductScopedDailySummary(daily, productCode, manualEntryConfig),
  );
}

export function buildProductScopedGrandTotalSummary(
  monthDailySummaries,
  productCode,
  manualEntryConfig,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(manualEntryConfig ?? defaultProductCode);
  const scopedDailies = buildProductScopedMonthDailySummaries(
    monthDailySummaries,
    productCode,
    config,
  );

  return buildGrandTotalSummaryFromManual(
    scopedDailies,
    normalizeProductCode(productCode),
    config,
  );
}

function buildGrandTotalRow(
  processRows,
  { outputProcessOnly = false, outputProcess = null, processes = [] } = {},
) {
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
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      total.defects[key] += row.defects[key] ?? 0;
    });
  });

  if (outputProcessOnly) {
    const outputRow = resolveOutputProcessRow(processRows, outputProcess);
    const chainComplete = isS90dProcessChainComplete(processRows, processes);
    if (outputRow) {
      total.totalQty = outputRow.totalQty;
      total.okQty = outputRow.okQty;
      total.ngQty = outputRow.ngQty;
      total.yieldPct = chainComplete ? outputRow.yieldPct ?? 0 : null;
      total.cumulativeYieldPct = chainComplete
        ? outputRow.cumulativeYieldPct ?? 0
        : null;
      total.ngRatePct = chainComplete ? outputRow.ngRatePct ?? 0 : null;
    }
  } else {
    processRows.forEach((row) => {
      total.totalQty += row.totalQty;
      total.okQty += row.okQty;
      total.ngQty += row.ngQty;
    });

    const finalProcessRow = resolveFinalProcessRow(
      processRows,
      outputProcess,
      processes,
    );
    total.yieldPct = total.totalQty
      ? yieldPctOrZero(total.okQty, total.totalQty)
      : null;
    total.cumulativeYieldPct = finalProcessRow?.cumulativeYieldPct ?? 0;
    total.ngRatePct = pctOrZero(total.ngQty, total.totalQty);
  }

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

function mergeGrandBoardRowAggregate(target, source) {
  target.totalQty += source.totalQty ?? 0;
  target.okQty += source.okQty ?? 0;
  target.ngQty += source.ngQty ?? 0;
  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    target.defects[key] += source.defects?.[key] ?? 0;
  });
  if (source.hasData) target.hasData = true;
}

function finalizeGrandBoardRowAggregate(row) {
  row.yieldPct = row.totalQty ? yieldPctOrZero(row.okQty, row.totalQty) : null;
  row.ngRatePct = row.totalQty ? pctOrZero(row.ngQty, row.totalQty) : null;
  row.defectTotal = sumDefectCounts(row.defects);
  return row;
}

export function buildGrandProcessDetailsFromManual(
  dailySummaries,
  processRows,
  manualEntryConfig = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(manualEntryConfig);
  const processRowByProcess = Object.fromEntries(
    processRows.map((row) => [row.process, row]),
  );

  return config.processes.map((process) => {
    const boardMap = new Map();

    dailySummaries.forEach((daily) => {
      const detail = daily.processDetails?.find((item) => item.process === process);
      if (!detail?.boardRows?.length) return;

      detail.boardRows.forEach((boardRow) => {
        const key = String(boardRow.boardId ?? boardRow.productCode ?? "").trim();
        if (!key) return;

        if (!boardMap.has(key)) {
          boardMap.set(key, {
            boardId: boardRow.boardId ?? key,
            label: boardRow.label ?? boardRow.productCode ?? key,
            productCode: boardRow.productCode ?? key,
            codeSlot:
              boardRow.codeSlot === "D" || boardRow.codeSlot === "E"
                ? boardRow.codeSlot
                : inferCodeSlotFromBoardId(boardRow.boardId ?? key),
            totalQty: 0,
            okQty: 0,
            ngQty: 0,
            yieldPct: 0,
            ngRatePct: 0,
            defects: createEmptyDefectCounts(),
            defectTotal: 0,
            hasData: false,
          });
        }

        mergeGrandBoardRowAggregate(boardMap.get(key), boardRow);
      });
    });

    const boardRows = [...boardMap.values()].map(finalizeGrandBoardRowAggregate);

    return {
      process,
      processRow: processRowByProcess[process] ?? emptyGrandProcessRow(process),
      boardRows,
      boardCount: boardRows.length || 1,
    };
  });
}

export function buildGrandTotalSummaryFromManual(
  dailySummaries,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  manualEntryConfig,
) {
  const config = resolveManualEntryConfig(manualEntryConfig ?? defaultProductCode);
  const byProcess = Object.fromEntries(
    config.processes.map((process) => [process, emptyGrandProcessRow(process)]),
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

  const processRows = config.processes.map((process) => {
    const row = byProcess[process];
    row.yieldPct = row.totalQty ? yieldPctOrZero(row.okQty, row.totalQty) : null;
    row.ngRatePct = row.totalQty ? pctOrZero(row.ngQty, row.totalQty) : null;
    row.defectTotal = sumDefectCounts(row.defects);
    return row;
  });

  const processDetails = buildGrandProcessDetailsFromManual(
    dailySummaries,
    processRows,
    config,
  );

  // Tab Tổng: tỷ lệ đạt / tỷ lệ đạt thẳng tính từ SL gom theo công đoạn (không trung bình Code D/E hay mã AP5).
  applyS90dProcessYieldMetrics(processRows, { emptyAsNull: true });

  if (config.fixedBoardSpecsAllProcesses) {
    applyBrokenChainYieldInvalidation(processRows, config.processes);
    applyBrokenChainBoardYieldInvalidation(processDetails, config.processes);
  }

  const outputProcess = config.processes[config.processes.length - 1];
  const totalRow = buildGrandTotalRow(processRows, {
    outputProcessOnly: config.fixedBoardSpecsAllProcesses,
    outputProcess,
    processes: config.processes,
  });
  const percentRow = buildGrandPercentRow(totalRow);
  const productCode =
    dailySummaries.find((daily) => daily.productCode)?.productCode ??
    config.defaultProductCode;

  return {
    productCode,
    processRows,
    processDetails,
    totalRow,
    percentRow,
    hasData: processRows.some((row) => row.totalQty > 0),
  };
}
