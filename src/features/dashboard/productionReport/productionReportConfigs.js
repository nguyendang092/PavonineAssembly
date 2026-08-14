import {
  AP5_BOARD_SPECS,
  AP5_PROCESSES,
  S90D_ASSEMBLY_BOARD_SPECS,
} from "../s90d/lib/s90dManualEntryReportConfig";
import { S90D_PROCESSES } from "../s90d/lib/s90dDefectColumns";
import { WORKPLACE_PRODUCTION_PATHS_S90D } from "../workplace/workplaceProductionPaths";

function buildDefectImageUploadPrefixFactory(prefix) {
  return function buildDefectImageUploadPrefix({
    dateKey,
    boardId = "",
    process,
    shiftSlot,
    defectKey,
  }) {
    const safe = (value) =>
      String(value ?? "")
        .trim()
        .replace(/[^\w-]+/g, "_");
    return [
      prefix,
      safe(dateKey),
      safe(boardId),
      safe(process),
      safe(shiftSlot),
      safe(defectKey),
    ]
      .filter(Boolean)
      .join("_");
  };
}

export const S90D_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "s90d",
  i18nPrefix: "s90dReport",
  defaultProductCode: "S90D",
  processes: S90D_PROCESSES,
  fixedBoardSpecs: S90D_ASSEMBLY_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: false,
  usesFixedBoardSpecs: true,
  firebaseRoot: WORKPLACE_PRODUCTION_PATHS_S90D.manualEntriesRoot,
  storageKey: "s90d-manual-entries-v1",
  excelSheetName: "S90D_Nhap",
  excelFilePrefix: "S90D",
  chartReportBadgeKey: "chartReportBadge",
  buildDefectImageUploadPrefix: buildDefectImageUploadPrefixFactory("s90d_defect"),
});

export const AP5_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "ap5",
  i18nPrefix: "ap5Report",
  defaultProductCode: "AP5",
  processes: AP5_PROCESSES,
  fixedBoardSpecs: AP5_BOARD_SPECS,
  fixedBoardSpecsAllProcesses: true,
  usesFixedBoardSpecs: true,
  firebaseRoot: "ap5/manualEntries",
  storageKey: "ap5-manual-entries-v1",
  excelSheetName: "AP5_Nhap",
  excelFilePrefix: "AP5",
  chartReportBadgeKey: "chartReportBadgeAp5",
  buildDefectImageUploadPrefix: buildDefectImageUploadPrefixFactory("ap5_defect"),
});

/** @deprecated Giữ tương thích import cũ — dùng AP5_PRODUCTION_REPORT_CONFIG. */
export const AP5FF_PRODUCTION_REPORT_CONFIG = AP5_PRODUCTION_REPORT_CONFIG;
export const AP5FZ_PRODUCTION_REPORT_CONFIG = AP5_PRODUCTION_REPORT_CONFIG;
export const AP5FL_PRODUCTION_REPORT_CONFIG = AP5_PRODUCTION_REPORT_CONFIG;

export const AP5_PRODUCT_CONFIGS = Object.freeze([AP5_PRODUCTION_REPORT_CONFIG]);
