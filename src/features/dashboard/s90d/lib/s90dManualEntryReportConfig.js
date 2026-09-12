import { S90D_PROCESSES } from "./s90dDefectColumns";

export const DEFAULT_PRODUCT_CODE = "S90D";
export const AP5_DEFAULT_PRODUCT_CODE = "AP5";
export const S95H_DEFAULT_PRODUCT_CODE = "S95H";
export const R95D_DEFAULT_PRODUCT_CODE = "R95D";
export const ASSEMBLY_PROCESS = "ASSEMBLY";

export const S90D_ASSEMBLY_BOARD_SPECS = Object.freeze([
  { id: "assembly-inzi", label: "S90D INZI", productCode: "S90D INZI" },
  { id: "assembly-mxc", label: "S90D MXC", productCode: "S90D MXC" },
]);

export const R95D_ASSEMBLY_BOARD_SPECS = Object.freeze([
  { id: "assembly-r95d65", label: "R95D 65", productCode: "R95D 65" },
  { id: "assembly-r95d75", label: "R95D 75", productCode: "R95D 75" },
]);

export const AP5_BOARD_SPECS = Object.freeze([
  { id: "ap5ff", label: "AP5FF", productCode: "AP5FF" },
  { id: "ap5fz", label: "AP5FZ", productCode: "AP5FZ" },
  { id: "ap5fl", label: "AP5FL", productCode: "AP5FL" },
]);

/** Tab MC có thêm 1 bảng AP5FL — tổng 4 bảng nhập liệu. */
export const AP5_MC_BOARD_SPECS = Object.freeze([
  ...AP5_BOARD_SPECS,
  { id: "ap5fl-mc", label: "AP5FL GE", productCode: "AP5FL" },
]);

export const AP5_PROCESS_BOARD_SPECS = Object.freeze({
  MC: AP5_MC_BOARD_SPECS,
});

export const AP5_PROCESSES = Object.freeze([
  "PRESS",
  "MC",
  "HAIRLINE",
  "ANODIZING",
  "ASSEMBLY",
]);

export const S95H_SUMMARY_VIEW_GROUPS = Object.freeze([
  { id: "deco", label: "Deco" },
  { id: "chassis", label: "Chassis" },
]);

export const S95H_BOARD_SPECS = Object.freeze([
  {
    id: "s95h65-deco",
    label: "S95H65 Deco",
    productCode: "S95H65 Deco",
    viewGroup: "deco",
  },
  {
    id: "s95h65-chassis",
    label: "S95H65 Chassis",
    productCode: "S95H65 Chassis",
    viewGroup: "chassis",
  },
  {
    id: "s95h55-deco",
    label: "S95H55 Deco",
    productCode: "S95H55 Deco",
    viewGroup: "deco",
  },
  {
    id: "s95h55-chassis",
    label: "S95H55 Chassis",
    productCode: "S95H55 Chassis",
    viewGroup: "chassis",
  },
]);

export const S95H_PROCESSES = AP5_PROCESSES;

export function resolveProcessBoardSpecs(process, config) {
  const processKey = String(process ?? "").trim();
  const override = config.processBoardSpecs?.[processKey];
  if (override?.length) return override;
  if (shouldApplyFixedBoardSpecs(process, config)) {
    return config.fixedBoardSpecs ?? [];
  }
  return [];
}

export function resolveSpecSummaryViewGroup(spec) {
  const explicit = String(spec?.viewGroup ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  const hay = `${spec?.id ?? ""} ${spec?.productCode ?? ""} ${spec?.label ?? ""}`.toLowerCase();
  if (hay.includes("chassis")) return "chassis";
  if (hay.includes("deco")) return "deco";
  return "";
}

export function filterSpecsBySummaryViewGroup(specs, viewGroup) {
  const group = String(viewGroup ?? "").trim().toLowerCase();
  if (!group || !Array.isArray(specs) || !specs.length) return specs ?? [];
  const filtered = specs.filter(
    (spec) => resolveSpecSummaryViewGroup(spec) === group,
  );
  return filtered.length ? filtered : specs;
}

export function createManualEntryConfig({
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  processes = S90D_PROCESSES,
  fixedBoardSpecs = null,
  fixedBoardSpecsAllProcesses = false,
  usesProductSubCodes = false,
  processBoardSpecs = null,
  codeSlots = null,
  codeSlotLabelPrefix = "Type",
  summaryViewGroups = null,
} = {}) {
  return Object.freeze({
    defaultProductCode,
    processes,
    fixedBoardSpecs,
    fixedBoardSpecsAllProcesses,
    usesFixedBoardSpecs: Boolean(fixedBoardSpecs?.length),
    usesProductSubCodes,
    processBoardSpecs,
    codeSlots,
    codeSlotLabelPrefix,
    summaryViewGroups,
  });
}

export const S90D_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: DEFAULT_PRODUCT_CODE,
  processes: S90D_PROCESSES,
  fixedBoardSpecs: S90D_ASSEMBLY_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: false,
  usesProductSubCodes: true,
});

export const R95D_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: R95D_DEFAULT_PRODUCT_CODE,
  processes: S90D_PROCESSES,
  fixedBoardSpecs: null,
  fixedBoardSpecsAllProcesses: false,
  usesProductSubCodes: true,
  codeSlots: ["65", "75"],
  codeSlotLabelPrefix: "",
});

export const AP5_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: AP5_DEFAULT_PRODUCT_CODE,
  processes: AP5_PROCESSES,
  fixedBoardSpecs: AP5_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
  processBoardSpecs: AP5_PROCESS_BOARD_SPECS,
});

export const S95H_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: S95H_DEFAULT_PRODUCT_CODE,
  processes: S95H_PROCESSES,
  fixedBoardSpecs: S95H_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
  summaryViewGroups: S95H_SUMMARY_VIEW_GROUPS,
});

export function resolveManualEntryConfig(input) {
  if (input?.processes) {
    return createManualEntryConfig(input);
  }

  const code =
    typeof input === "string"
      ? input
      : input?.defaultProductCode ?? DEFAULT_PRODUCT_CODE;

  if (code === AP5_DEFAULT_PRODUCT_CODE) {
    return AP5_MANUAL_ENTRY_CONFIG;
  }

  if (code === S95H_DEFAULT_PRODUCT_CODE) {
    return S95H_MANUAL_ENTRY_CONFIG;
  }

  if (code === R95D_DEFAULT_PRODUCT_CODE || code === "R95H") {
    return R95D_MANUAL_ENTRY_CONFIG;
  }

  return S90D_MANUAL_ENTRY_CONFIG;
}

export function manualEntryConfigFromReportConfig(reportConfig = {}) {
  return createManualEntryConfig({
    defaultProductCode:
      reportConfig.defaultProductCode ?? DEFAULT_PRODUCT_CODE,
    processes: reportConfig.processes ?? S90D_PROCESSES,
    fixedBoardSpecs: reportConfig.fixedBoardSpecs ?? null,
    fixedBoardSpecsAllProcesses:
      reportConfig.fixedBoardSpecsAllProcesses ?? false,
    usesProductSubCodes: reportConfig.usesProductSubCodes ?? false,
    processBoardSpecs: reportConfig.processBoardSpecs ?? null,
    codeSlots: reportConfig.codeSlots ?? null,
    codeSlotLabelPrefix: reportConfig.codeSlotLabelPrefix ?? "Type",
    summaryViewGroups: reportConfig.summaryViewGroups ?? null,
  });
}

export function shouldApplyFixedBoardSpecs(process, config) {
  if (!config?.fixedBoardSpecs?.length) return false;
  if (config.fixedBoardSpecsAllProcesses) return true;
  return process === ASSEMBLY_PROCESS;
}
