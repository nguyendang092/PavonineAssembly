import {
  AP5_BOARD_SPECS,
  AP5_PROCESS_BOARD_SPECS,
  AP5_PROCESSES,
  AP5_SUMMARY_VIEW_GROUPS,
  S90D_ASSEMBLY_BOARD_SPECS,
  S90D_SIZE_BOARD_SPECS,
  S90D_SUMMARY_VIEW_GROUPS,
  S95H_BOARD_SPECS,
  S95H_PROCESSES,
  S95H_SUMMARY_VIEW_GROUPS,
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
  summaryViewGroups: S90D_SUMMARY_VIEW_GROUPS,
  summaryBoardSpecs: S90D_SIZE_BOARD_SPECS,
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
  summaryViewGroups: AP5_SUMMARY_VIEW_GROUPS,
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
  summaryViewGroups: S95H_SUMMARY_VIEW_GROUPS,
  firebaseRoot: "s95h/manualEntries",
  storageKey: "s95h-manual-entries-v1",
  excelSheetName: "S95H_Nhap",
  excelFilePrefix: "S95H",
  chartReportBadgeKey: "chartReportBadgeS95h",
});
