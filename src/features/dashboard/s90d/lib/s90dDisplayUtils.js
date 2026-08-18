import { inferCodeSlotFromBoardId, formatS90dTypeSlotLabel } from "./s90dEntryBoardSpecs";
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
