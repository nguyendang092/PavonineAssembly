export const MC_DEFECT_REPORT_PATH = "mcDefectReport/byDate";
export const DEFAULT_DEPARTMENT = "Chưa phân loại";
export const DEFAULT_ERROR_TYPE = "Chưa phân loại";
export const MC_DEFECT_ROWS_PER_PAGE = 10;

export const MC_DEFECT_CHART_PRIMARY = "#ec4899";
export const MC_DEFECT_CHART_TEXT = "#000000";
export const MC_DEFECT_LINE_CHART_HEIGHT_PX = 380;

export const MC_DEFECT_CHART_TOOLTIP_PROPS = {
  contentStyle: { color: MC_DEFECT_CHART_TEXT },
  labelStyle: { color: MC_DEFECT_CHART_TEXT },
  itemStyle: { color: MC_DEFECT_CHART_TEXT },
};

/** Nhiều màu tách biệt — donut «Phân bổ theo loại lỗi». */
export const MC_DEFECT_ERROR_TYPE_COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#c026d3",
  "#65a30d",
  "#dc2626",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#db2777",
  "#1d4ed8",
  "#b45309",
  "#14b8a6",
  "#a21caf",
];

export const MC_DEFECT_FILTER_ALL = "ALL";

export const INITIAL_MC_DEFECT_FORM = {
  date: new Date().toISOString().slice(0, 10),
  employee: "",
  department: "MC",
  errorType: "Poorwork",
  errorCount: "",
  note: "",
};
