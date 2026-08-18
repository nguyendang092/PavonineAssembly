import {
  ASSEMBLY_PROCESS,
  DEFAULT_PRODUCT_CODE,
  resolveManualEntryConfig,
  shouldApplyFixedBoardSpecs,
} from "./s90dManualEntryReportConfig";

export const S90D_CODE_SLOTS = Object.freeze(["D", "E"]);
export const S90D_TYPE_SLOT_LABEL = "Type";

export function formatS90dTypeSlotLabel(codeSlot) {
  if (codeSlot !== "D" && codeSlot !== "E") return "";
  return `${S90D_TYPE_SLOT_LABEL} ${codeSlot}`;
}

export function inferCodeSlotFromBoardId(boardId) {
  const id = String(boardId ?? "").trim().toLowerCase();
  if (id.endsWith("-coded") || id.endsWith("-code-d")) return "D";
  if (id.endsWith("-codee") || id.endsWith("-code-e")) return "E";
  return null;
}

/** @returns {Array<{ id: string, label: string, productCode: string, codeSlot?: "D"|"E"|null, parentBoardId?: string }>} */
export function buildS90dEntryBoardSpecs(process, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);

  if (!config.usesProductSubCodes) {
    if (shouldApplyFixedBoardSpecs(process, config)) {
      return (config.fixedBoardSpecs ?? []).map((spec) => ({
        id: spec.id,
        label: spec.label,
        productCode: spec.productCode,
        codeSlot: null,
        parentBoardId: spec.id,
      }));
    }
    return [
      {
        id: "board-1",
        label: "Bảng 1",
        productCode: config.defaultProductCode,
        codeSlot: null,
        parentBoardId: "board-1",
      },
    ];
  }

  if (shouldApplyFixedBoardSpecs(process, config)) {
    return (config.fixedBoardSpecs ?? []).flatMap((spec) =>
      S90D_CODE_SLOTS.map((codeSlot) => ({
        id: `${spec.id}-code${codeSlot.toLowerCase()}`,
        label: `${spec.label} · ${formatS90dTypeSlotLabel(codeSlot)}`,
        productCode: spec.productCode,
        codeSlot,
        parentBoardId: spec.id,
      })),
    );
  }

  const processKey = String(process ?? "process").toLowerCase();
  return S90D_CODE_SLOTS.map((codeSlot) => ({
    id: `${processKey}-code${codeSlot.toLowerCase()}`,
    label: formatS90dTypeSlotLabel(codeSlot),
    productCode: config.defaultProductCode,
    codeSlot,
    parentBoardId: `${processKey}-code${codeSlot.toLowerCase()}`,
  }));
}

export function resolveDisplayBoardGroupKey(board) {
  if (board?.parentBoardId) return String(board.parentBoardId).trim();
  const inferredParent = String(board?.id ?? "")
    .trim()
    .replace(/-code[de]$/i, "");
  return inferredParent || String(board?.productCode ?? "").trim();
}

export function shouldShowProductBoardRows(process, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  if (shouldApplyFixedBoardSpecs(process, config)) {
    return (config.fixedBoardSpecs?.length ?? 0) >= 2;
  }
  return config.usesProductSubCodes;
}
