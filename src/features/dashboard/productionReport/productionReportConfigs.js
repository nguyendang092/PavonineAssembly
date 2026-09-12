import {
  AP5_BOARD_SPECS,
  AP5_PROCESS_BOARD_SPECS,
  AP5_PROCESSES,
  S90D_ASSEMBLY_BOARD_SPECS,
  S95H_BOARD_SPECS,
  S95H_PROCESSES,
} from "../s90d/lib/s90dManualEntryReportConfig";
import { S90D_PROCESSES } from "../s90d/lib/s90dDefectColumns";
import { WORKPLACE_PRODUCTION_PATHS_S90D } from "../workplace/workplaceProductionPaths";

export const S90D_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "s90d",
  i18nPrefix: "s90dReport",
  defaultProductCode: "S90D",
  processes: S90D_PROCESSES,
  fixedBoardSpecs: S90D_ASSEMBLY_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: false,
  usesFixedBoardSpecs: true,
  usesProductSubCodes: true,
  firebaseRoot: WORKPLACE_PRODUCTION_PATHS_S90D.manualEntriesRoot,
  storageKey: "s90d-manual-entries-v1",
  excelSheetName: "S90D_Nhap",
  excelFilePrefix: "S90D",
  chartReportBadgeKey: "chartReportBadge",
});

export const AP5_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "ap5",
  i18nPrefix: "ap5Report",
  defaultProductCode: "AP5",
  processes: AP5_PROCESSES,
  fixedBoardSpecs: AP5_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
  processBoardSpecs: AP5_PROCESS_BOARD_SPECS,
  usesFixedBoardSpecs: true,
  firebaseRoot: "ap5/manualEntries",
  storageKey: "ap5-manual-entries-v1",
  excelSheetName: "AP5_Nhap",
  excelFilePrefix: "AP5",
  chartReportBadgeKey: "chartReportBadgeAp5",
});

export const S95H_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "s95h",
  i18nPrefix: "s95hReport",
  defaultProductCode: "S95H",
  processes: S95H_PROCESSES,
  fixedBoardSpecs: S95H_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
  usesFixedBoardSpecs: true,
  firebaseRoot: "s95h/manualEntries",
  storageKey: "s95h-manual-entries-v1",
  excelSheetName: "S95H_Nhap",
  excelFilePrefix: "S95H",
  chartReportBadgeKey: "chartReportBadgeS95h",
});

export const R95H_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "r95h",
  i18nPrefix: "r95hReport",
  defaultProductCode: "R95H",
  processes: S90D_PROCESSES,
  fixedBoardSpecs: null,
  fixedBoardSpecsAllProcesses: false,
  usesFixedBoardSpecs: false,
  usesProductSubCodes: true,
  firebaseRoot: "r95h/manualEntries",
  storageKey: "r95h-manual-entries-v1",
  excelSheetName: "R95H_Nhap",
  excelFilePrefix: "R95H",
  chartReportBadgeKey: "chartReportBadgeR95h",
  codeSlots: ["65", "75"],
  codeSlotLabelPrefix: "",
});
