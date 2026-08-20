import { S90D_CODE_SLOTS } from "./s90dEntryBoardSpecs";
import { findBoardRowForProduct, findMergedBoardRowForProduct } from "./s90dProcessChain";

/** Công đoạn hiển thị hiệu suất = (SL đạt/Tổng SL) / hiệu suất công đoạn trước (cùng mã/Code). */
export const S90D_CHAIN_DISPLAY_YIELD_PROCESSES = new Set([
  "MC",
  "HAIRLINE",
  "ANODIZING",
  "ASSEMBLY",
]);

export function roundYieldPct(value) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(Number(value) * 10) / 10;
  return Math.min(100, Math.max(0, rounded));
}

function computeStepYieldPct(row) {
  if (!row?.totalQty) return null;
  return roundYieldPct((row.okQty / row.totalQty) * 100);
}

function applyRowDisplayYield(row, process, previousDisplayYield, { emptyAsNull = false } = {}) {
  const stepYield = computeStepYieldPct(row);
  row.stepYieldPct = stepYield;

  if (emptyAsNull && !row.totalQty) {
    row.yieldPct = null;
    return null;
  }

  if (stepYield == null) {
    row.yieldPct = null;
    return null;
  }

  if (
    S90D_CHAIN_DISPLAY_YIELD_PROCESSES.has(process) &&
    previousDisplayYield
  ) {
    row.yieldPct = roundYieldPct((stepYield / previousDisplayYield) * 100);
  } else {
    row.yieldPct = stepYield;
  }

  return row.yieldPct;
}

function findBoardRowByCodeSlot(processDetails, process, codeSlot) {
  const detail = processDetails?.find((item) => item.process === process);
  return detail?.boardRows?.find((board) => board.codeSlot === codeSlot) ?? null;
}

/**
 * Hiệu suất theo từng Code D / Code E xuyên suốt chuỗi công đoạn.
 * PRESS = SL đạt/Tổng SL; MC+ = bước hiện tại / hiệu suất công đoạn trước (cùng code).
 */
export function applyS90dCodeSlotYieldMetrics(
  processDetails,
  processRows,
  processes,
  options = {},
) {
  for (const codeSlot of S90D_CODE_SLOTS) {
    let previousDisplayYield = null;

    for (const process of processes ?? []) {
      const boardRow = findBoardRowByCodeSlot(processDetails, process, codeSlot);
      if (!boardRow) continue;

      const displayYield = applyRowDisplayYield(
        boardRow,
        process,
        previousDisplayYield,
        options,
      );

      if (displayYield != null && boardRow.totalQty > 0) {
        previousDisplayYield = displayYield;
      } else {
        previousDisplayYield = null;
      }
    }
  }

  for (const process of processes ?? []) {
    const row = processRows?.find((item) => item.process === process);
    const detail = processDetails?.find((item) => item.process === process);
    if (!row) continue;

    row.stepYieldPct = computeStepYieldPct(row);

    if (options.emptyAsNull && !row.totalQty) {
      row.yieldPct = null;
      continue;
    }

    const codeBoards = (detail?.boardRows ?? []).filter(
      (board) => board.codeSlot === "D" || board.codeSlot === "E",
    );

    if (!S90D_CHAIN_DISPLAY_YIELD_PROCESSES.has(process)) {
      row.yieldPct = row.stepYieldPct;
      continue;
    }

    const displayYields = codeBoards
      .map((board) => board.yieldPct)
      .filter((value) => value != null && Number.isFinite(value));

    if (displayYields.length > 0) {
      row.yieldPct = roundYieldPct(
        displayYields.reduce((sum, value) => sum + value, 0) /
          displayYields.length,
      );
    } else {
      row.yieldPct = row.stepYieldPct;
    }
  }

  applyS90dCumulativeYieldPct(processRows, options);
}

/**
 * Hiệu suất theo từng mã hàng (AP5FF / AP5FZ / AP5FL) xuyên suốt chuỗi công đoạn.
 * PRESS, MC = SL đạt/Tổng SL; HAIRLINE+ = bước hiện tại / hiệu suất công đoạn trước (cùng mã).
 */
export function applyS90dProductBoardYieldMetrics(
  processDetails,
  processRows,
  processes,
  productCodes = [],
  options = {},
) {
  for (const productCode of productCodes) {
    let previousDisplayYield = null;

    for (const process of processes ?? []) {
      const detail = processDetails?.find((item) => item.process === process);
      const boardRow = findMergedBoardRowForProduct(detail, productCode);
      if (!boardRow) continue;

      const displayYield = applyRowDisplayYield(
        boardRow,
        process,
        previousDisplayYield,
        options,
      );

      if (displayYield != null && boardRow.totalQty > 0) {
        previousDisplayYield = displayYield;
      } else {
        previousDisplayYield = null;
      }
    }
  }

  for (const process of processes ?? []) {
    const row = processRows?.find((item) => item.process === process);
    const detail = processDetails?.find((item) => item.process === process);
    if (!row) continue;

    row.stepYieldPct = computeStepYieldPct(row);

    if (options.emptyAsNull && !row.totalQty) {
      row.yieldPct = null;
      continue;
    }

    const productBoards = detail?.boardRows ?? [];

    if (!S90D_CHAIN_DISPLAY_YIELD_PROCESSES.has(process)) {
      row.yieldPct = row.stepYieldPct;
      continue;
    }

    const displayYields = productBoards
      .map((board) => board.yieldPct)
      .filter((value) => value != null && Number.isFinite(value));

    if (displayYields.length > 0) {
      row.yieldPct = roundYieldPct(
        displayYields.reduce((sum, value) => sum + value, 0) /
          displayYields.length,
      );
    } else {
      row.yieldPct = row.stepYieldPct;
    }
  }

  applyS90dCumulativeYieldPct(processRows, options);
}

/**
 * Hiển thị hiệu suất tab ngày/tổng (không tách Code D/E / mã hàng):
 * - PRESS = SL đạt / Tổng SL
 * - MC = (SL đạt / Tổng SL) / hiệu suất PRESS * 100
 * - HAIRLINE = … / hiệu suất MC * 100
 * - ANODIZING = … / hiệu suất HAIRLINE * 100
 * - ASSEMBLY = … / hiệu suất ANODIZING * 100
 */
export function applyS90dDisplayYieldPct(
  processRows,
  { emptyAsNull = false } = {},
) {
  let previousDisplayYield = null;

  (processRows ?? []).forEach((row) => {
    const displayYield = applyRowDisplayYield(
      row,
      row.process,
      previousDisplayYield,
      { emptyAsNull },
    );

    if (displayYield != null && row.totalQty > 0) {
      previousDisplayYield = displayYield;
    } else if (emptyAsNull && !row.totalQty) {
      previousDisplayYield = null;
    }
  });
}

/**
 * Tích lũy S90D (cột Tích lũy) — tính trên hiệu suất bước (SL đạt/Tổng SL).
 */
export function computeS90dCumulativeYieldPct(
  currentYield,
  previousCumulative,
  index,
) {
  if (index === 0) {
    return roundYieldPct(currentYield ?? 0) ?? 0;
  }
  if (!previousCumulative) return 0;
  return roundYieldPct(((currentYield ?? 0) / previousCumulative) * 100);
}

export function applyS90dCumulativeYieldPct(
  processRows,
  { emptyAsNull = false } = {},
) {
  let previousCumulative = null;
  let hadEmptyProcessSinceLastCumulative = false;

  (processRows ?? []).forEach((row) => {
    if (!row.totalQty) {
      row.cumulativeYieldPct = null;
      hadEmptyProcessSinceLastCumulative = true;
      return;
    }

    const stepYield =
      row.stepYieldPct ?? computeStepYieldPct(row) ?? row.yieldPct;

    if (previousCumulative == null) {
      if (emptyAsNull && hadEmptyProcessSinceLastCumulative) {
        row.cumulativeYieldPct = null;
        return;
      }
      row.cumulativeYieldPct = computeS90dCumulativeYieldPct(
        stepYield,
        null,
        0,
      );
    } else {
      row.cumulativeYieldPct = computeS90dCumulativeYieldPct(
        stepYield,
        previousCumulative,
        1,
      );
    }

    if (row.totalQty > 0 && row.cumulativeYieldPct != null) {
      previousCumulative = row.cumulativeYieldPct;
      hadEmptyProcessSinceLastCumulative = false;
    }
  });
}

export function applyS90dProcessYieldMetrics(processRows, options = {}) {
  applyS90dDisplayYieldPct(processRows, options);
  applyS90dCumulativeYieldPct(processRows, options);
}

export function applyS90dReportYieldMetrics(
  {
    processDetails = [],
    processRows = [],
    processes = [],
    usesProductSubCodes = false,
    fixedBoardSpecsAllProcesses = false,
    fixedBoardSpecs = [],
  },
  options = {},
) {
  if (usesProductSubCodes) {
    applyS90dCodeSlotYieldMetrics(
      processDetails,
      processRows,
      processes,
      options,
    );
    return;
  }

  if (fixedBoardSpecsAllProcesses && fixedBoardSpecs?.length) {
    const productCodes = fixedBoardSpecs.map((spec) => spec.productCode);
    applyS90dProductBoardYieldMetrics(
      processDetails,
      processRows,
      processes,
      productCodes,
      options,
    );
    return;
  }

  applyS90dProcessYieldMetrics(processRows, options);
}
