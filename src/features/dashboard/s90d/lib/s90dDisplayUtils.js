import {
  inferCodeSlotFromBoardId,
  formatS90dTypeSlotLabel,
  resolveDisplayBoardGroupKey,
} from "./s90dEntryBoardSpecs";
import {
  createEmptyDefectCounts,
  S90D_DEFECT_COLUMNS,
  sumDefectCounts,
} from "./s90dDefectColumns";
import { roundYieldPct } from "./s90dCumulativeYield";
import { DEFAULT_PRODUCT_CODE } from "./s90dManualEntryReportConfig";

export { formatS90dTypeSlotLabel, S90D_TYPE_SLOT_LABEL } from "./s90dEntryBoardSpecs";

export function formatS90dProductTypeLabel(
  productCode,
  codeSlot,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
) {
  const base = String(productCode ?? "").trim() || defaultProductCode;
  if (codeSlot === "D" || codeSlot === "E") {
    return `${base} ${formatS90dTypeSlotLabel(codeSlot)}`;
  }
  return base;
}

export function formatShiftLineLabel(shiftSlot) {
  if (!shiftSlot || shiftSlot === "TOTAL" || shiftSlot === "PERCENT") {
    return shiftSlot;
  }
  if (shiftSlot === "00~03") return "00-03";
  return String(shiftSlot).replace(/~/g, "-");
}
export function formatShortDateLabel(dateKey, fallback = "") {
  if (!dateKey || typeof dateKey !== "string") return fallback;
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}`;
  return fallback || dateKey;
}

function resolveBoardCodeSlot(boardRow) {
  if (boardRow?.codeSlot === "D" || boardRow?.codeSlot === "E") {
    return boardRow.codeSlot;
  }

  const fromId = inferCodeSlotFromBoardId(boardRow?.boardId ?? boardRow?.id);
  if (fromId) return fromId;

  const label = String(boardRow?.label ?? "");
  const match = label.match(/(?:Code|Type)\s+([DE])\b/i);
  return match ? match[1].toUpperCase() : null;
}

function summaryPctOrZero(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function summaryYieldPct(numerator, denominator) {
  if (!denominator) return null;
  return roundYieldPct((numerator / denominator) * 100);
}

/** Gộp board Type D/E cùng mã hàng thành một dòng cho tab Tổng/Theo ngày. */
export function aggregateBoardRowsByProductGroup(boardRows = []) {
  if (!boardRows.length) return [];

  const groupMap = new Map();

  boardRows.forEach((row) => {
    const groupKey =
      resolveDisplayBoardGroupKey(row) ||
      String(row.productCode ?? "").trim() ||
      String(row.boardId ?? row.id ?? "").trim();
    if (!groupKey) return;

    if (!groupMap.has(groupKey)) {
      const productCode =
        String(row.productCode ?? "").trim() ||
        String(row.label ?? "")
          .trim()
          .replace(/\s*·?\s*Type\s+[DE]\b/i, "");

      groupMap.set(groupKey, {
        boardId: groupKey,
        productCode: productCode || groupKey,
        label: productCode || groupKey,
        codeSlot: null,
        totalQty: 0,
        okQty: 0,
        ngQty: 0,
        yieldPct: null,
        ngRatePct: null,
        defects: createEmptyDefectCounts(),
        defectTotal: 0,
      });
    }

    const target = groupMap.get(groupKey);
    target.totalQty += row.totalQty ?? 0;
    target.okQty += row.okQty ?? 0;
    target.ngQty += row.ngQty ?? 0;
    S90D_DEFECT_COLUMNS.forEach(({ key }) => {
      target.defects[key] += row.defects?.[key] ?? 0;
    });
  });

  return [...groupMap.values()].map((row) => ({
    ...row,
    yieldPct: summaryYieldPct(row.okQty, row.totalQty),
    ngRatePct: summaryPctOrZero(row.ngQty, row.totalQty),
    defectTotal: sumDefectCounts(row.defects),
  }));
}

/** @param {{ boardId?: string, id?: string, label?: string, productCode?: string, codeSlot?: "D"|"E"|null }} boardRow */
export function formatS90dBoardDisplayName(
  boardRow,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
) {
  const productCode = String(boardRow?.productCode ?? "").trim();
  const codeSlot = resolveBoardCodeSlot(boardRow);

  if (codeSlot) {
    return formatS90dProductTypeLabel(productCode, codeSlot, defaultProductCode);
  }

  if (productCode) return productCode;

  const label = String(boardRow?.label ?? "").trim();
  return label || defaultProductCode;
}

/** Ô lỗi cần tô hồng khi chiếm ≥ 15% tổng NG. */
export function isHighDefectCell(defectQty, totalNgQty) {
  if (!defectQty || !totalNgQty) return false;
  return defectQty / totalNgQty >= 0.15;
}

export function formatS90dDailyQty(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export function capYieldPct(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return null;
  return Math.min(100, Math.max(0, Number(value)));
}

export function formatS90dDailyPct(value) {
  if (value == null || value === "") return "";
  return `${capYieldPct(value).toLocaleString("vi-VN")}%`;
}

export function formatS90dYieldPct(value, emptyLabel = "0%") {
  if (value == null || value === "") return emptyLabel;
  return `${capYieldPct(value).toLocaleString("vi-VN")}%`;
}

export function resolveS90dStepYieldPct(row) {
  if (!row?.totalQty) return null;
  return capYieldPct((Number(row.okQty ?? 0) / Number(row.totalQty)) * 100);
}

/** Tích lũy (cột 직진율) — luôn lấy cumulativeYieldPct của đúng công đoạn. */
export function resolveS90dCumulativeYieldPct(row, { isTotal = false } = {}) {
  if (!row) return null;
  if (isTotal) {
    if (row.cumulativeYieldPct != null && row.cumulativeYieldPct !== "") {
      return capYieldPct(row.cumulativeYieldPct);
    }
    return resolveS90dTotalYieldPct(row);
  }
  if (row.cumulativeYieldPct != null && row.cumulativeYieldPct !== "") {
    return capYieldPct(row.cumulativeYieldPct);
  }
  return null;
}

/** Hiệu suất chuỗi — logic hiển thị cột Hiệu suất (tab Tổng/Theo ngày). */
export function resolveS90dChainYieldPct(row, { isTotal = false } = {}) {
  if (!row) return null;
  if (isTotal) return resolveS90dTotalYieldPct(row);
  if (row.yieldPct != null && row.yieldPct !== "") {
    return capYieldPct(row.yieldPct);
  }
  if (row.cumulativeYieldPct != null && row.cumulativeYieldPct !== "") {
    return capYieldPct(row.cumulativeYieldPct);
  }
  return resolveS90dStepYieldPct(row);
}

/** Hiệu suất dòng TOTAL — lấy từ công đoạn cuối (ASSEMBLY), khớp dòng ASSEMBLY. */
export function resolveS90dTotalYieldPct(row) {
  if (!row) return null;
  if (row.yieldPct != null && row.yieldPct !== "") {
    return capYieldPct(row.yieldPct);
  }
  if (row.cumulativeYieldPct != null && row.cumulativeYieldPct !== "") {
    return capYieldPct(row.cumulativeYieldPct);
  }
  if (Number(row.totalQty) > 0) {
    return capYieldPct((Number(row.okQty) / Number(row.totalQty)) * 100);
  }
  return null;
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
