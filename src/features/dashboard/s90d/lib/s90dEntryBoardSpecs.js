import {
  DEFAULT_PRODUCT_CODE,
  resolveManualEntryConfig,
  resolveProcessBoardSpecs,
  shouldApplyFixedBoardSpecs,
} from "./s90dManualEntryReportConfig";

export const S90D_CODE_SLOTS = Object.freeze(["D", "E"]);
export const R95H_CODE_SLOTS = Object.freeze(["65", "75"]);
export const S90D_TYPE_SLOT_LABEL = "Type";

export function resolveCodeSlots(config) {
  return config?.codeSlots?.length ? config.codeSlots : S90D_CODE_SLOTS;
}

export function formatCodeSlotProductCode(defaultProductCode, codeSlot) {
  const base = String(defaultProductCode ?? "").replace(/\s+/g, "");
  const slot = String(codeSlot ?? "").replace(/\s+/g, "");
  if (!slot) return base;
  if (!base) return slot;
  const upperBase = base.toUpperCase();
  const upperSlot = slot.toUpperCase();
  if (upperSlot.startsWith(upperBase)) return `${base}${slot.slice(base.length)}`;
  return `${base}${slot}`;
}

export function codeSlotToIdSuffix(codeSlot) {
  return String(codeSlot ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isTrackedCodeSlot(codeSlot, config) {
  const slot = String(codeSlot ?? "").trim();
  if (!slot) return false;
  const slots = resolveCodeSlots(config);
  if (slots.includes(slot)) return true;
  return slot === "D" || slot === "E" || slot === "65" || slot === "75";
}

export function formatS90dTypeSlotLabel(codeSlot, config) {
  const slot = String(codeSlot ?? "").trim();
  if (!slot) return "";
  if (config?.codeSlotLabelPrefix === "") return slot;
  if (slot === "D" || slot === "E") return `${S90D_TYPE_SLOT_LABEL} ${slot}`;
  return slot;
}

export function codeSlotCssTone(codeSlot) {
  const slot = String(codeSlot ?? "").trim();
  if (slot === "D" || slot === "65") return "d";
  if (slot === "E" || slot === "75") return "e";
  return "";
}

export function inferCodeSlotFromBoardId(boardId, config) {
  const id = String(boardId ?? "").trim().toLowerCase();
  const match = id.match(/-code-?([a-z0-9]+)$/i);
  if (!match) return null;

  const raw = match[1].toLowerCase();
  const slots = resolveCodeSlots(config);

  if (raw === "d") return slots[0] ?? "D";
  if (raw === "e") return slots[1] ?? "E";

  const fromSlots = slots.find((slot) => codeSlotToIdSuffix(slot) === raw);
  if (fromSlots) return fromSlots;
  if (raw === "65" || raw === "75") return raw;
  return null;
}

export function mapLegacyCodeSlot(codeSlot, config) {
  const slot = String(codeSlot ?? "").trim();
  const slots = resolveCodeSlots(config);
  if (slot === "D") return slots[0] ?? "D";
  if (slot === "E") return slots[1] ?? "E";
  return slot;
}

/** @returns {Array<{ id: string, label: string, productCode: string, codeSlot?: string|null, parentBoardId?: string }>} */
export function buildS90dEntryBoardSpecs(process, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  const codeSlots = resolveCodeSlots(config);

  if (!config.usesProductSubCodes) {
    const boardSpecs = resolveProcessBoardSpecs(process, config);
    if (boardSpecs.length) {
      return boardSpecs.map((spec) => ({
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
      codeSlots.map((codeSlot) => ({
        id: `${spec.id}-code${codeSlotToIdSuffix(codeSlot)}`,
        label: `${spec.label} · ${formatS90dTypeSlotLabel(codeSlot, config)}`,
        productCode: spec.productCode,
        codeSlot,
        parentBoardId: spec.id,
      })),
    );
  }

  const processKey = String(process ?? "process").toLowerCase();
  return codeSlots.map((codeSlot) => ({
    id: `${processKey}-code${codeSlotToIdSuffix(codeSlot)}`,
    label: formatS90dTypeSlotLabel(codeSlot, config),
    productCode: config.defaultProductCode,
    codeSlot,
    parentBoardId: `${processKey}-code${codeSlotToIdSuffix(codeSlot)}`,
  }));
}

export function resolveDisplayBoardGroupKey(board) {
  if (board?.parentBoardId) return String(board.parentBoardId).trim();
  const inferredParent = String(board?.id ?? "")
    .trim()
    .replace(/-code-?[a-z0-9]+$/i, "");
  return inferredParent || String(board?.productCode ?? "").trim();
}

export function shouldShowProductBoardRows(process, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  const boardSpecs = resolveProcessBoardSpecs(process, config);
  if (boardSpecs.length >= 2) return true;
  return config.usesProductSubCodes;
}
