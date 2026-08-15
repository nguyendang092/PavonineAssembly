import { S90D_PROCESSES } from "./s90dDefectColumns";

export const DEFAULT_PRODUCT_CODE = "S90D";
export const AP5_DEFAULT_PRODUCT_CODE = "AP5";
export const ASSEMBLY_PROCESS = "ASSEMBLY";

export const S90D_ASSEMBLY_BOARD_SPECS = Object.freeze([
  { id: "assembly-inzi", label: "S90D INZI", productCode: "S90D INZI" },
  { id: "assembly-mxc", label: "S90D MXC", productCode: "S90D MXC" },
]);

export const AP5_BOARD_SPECS = Object.freeze([
  { id: "ap5ff", label: "AP5FF", productCode: "AP5FF" },
  { id: "ap5fz", label: "AP5FZ", productCode: "AP5FZ" },
  { id: "ap5fl", label: "AP5FL", productCode: "AP5FL" },
]);

export const AP5_PROCESSES = Object.freeze([
  "PRESS",
  "MC",
  "HAIRLINE",
  "ANODIZING",
  "ASSEMBLY",
]);

export function createManualEntryConfig({
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  processes = S90D_PROCESSES,
  fixedBoardSpecs = null,
  fixedBoardSpecsAllProcesses = false,
  usesProductSubCodes = false,
} = {}) {
  return Object.freeze({
    defaultProductCode,
    processes,
    fixedBoardSpecs,
    fixedBoardSpecsAllProcesses,
    usesFixedBoardSpecs: Boolean(fixedBoardSpecs?.length),
    usesProductSubCodes,
  });
}

export const S90D_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: DEFAULT_PRODUCT_CODE,
  processes: S90D_PROCESSES,
  fixedBoardSpecs: S90D_ASSEMBLY_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: false,
  usesProductSubCodes: true,
});

export const AP5_MANUAL_ENTRY_CONFIG = createManualEntryConfig({
  defaultProductCode: AP5_DEFAULT_PRODUCT_CODE,
  processes: AP5_PROCESSES,
  fixedBoardSpecs: AP5_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
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
  });
}

export function shouldApplyFixedBoardSpecs(process, config) {
  if (!config?.fixedBoardSpecs?.length) return false;
  if (config.fixedBoardSpecsAllProcesses) return true;
  return (
    process === ASSEMBLY_PROCESS &&
    config.defaultProductCode === DEFAULT_PRODUCT_CODE
  );
}
