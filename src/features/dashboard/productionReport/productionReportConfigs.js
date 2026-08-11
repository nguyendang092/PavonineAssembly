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
  firebaseRoot: WORKPLACE_PRODUCTION_PATHS_S90D.manualEntriesRoot,
  storageKey: "s90d-manual-entries-v1",
  excelSheetName: "S90D_Nhap",
  excelFilePrefix: "S90D",
  chartReportBadgeKey: "chartReportBadge",
  buildDefectImageUploadPrefix: buildDefectImageUploadPrefixFactory("s90d_defect"),
});

export const AP5FF_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "ap5ff",
  i18nPrefix: "ap5Report",
  defaultProductCode: "AP5FF",
  firebaseRoot: "ap5ff/manualEntries",
  storageKey: "ap5ff-manual-entries-v1",
  excelSheetName: "AP5FF_Nhap",
  excelFilePrefix: "AP5FF",
  chartReportBadgeKey: "chartReportBadgeAp5ff",
  buildDefectImageUploadPrefix: buildDefectImageUploadPrefixFactory("ap5ff_defect"),
});

export const AP5FZ_PRODUCTION_REPORT_CONFIG = Object.freeze({
  id: "ap5fz",
  i18nPrefix: "ap5Report",
  defaultProductCode: "AP5FZ",
  firebaseRoot: "ap5fz/manualEntries",
  storageKey: "ap5fz-manual-entries-v1",
  excelSheetName: "AP5FZ_Nhap",
  excelFilePrefix: "AP5FZ",
  chartReportBadgeKey: "chartReportBadgeAp5fz",
  buildDefectImageUploadPrefix: buildDefectImageUploadPrefixFactory("ap5fz_defect"),
});

export const AP5_PRODUCT_CONFIGS = Object.freeze([
  AP5FF_PRODUCTION_REPORT_CONFIG,
  AP5FZ_PRODUCTION_REPORT_CONFIG,
]);
