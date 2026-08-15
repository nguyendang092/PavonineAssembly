import { CHART_ORDER_KIND } from "@/utils/chartOrderStorage";

/** @typedef {{ barRoot: string, detailsRoot: string, ngRoot: string, chartOrderKind: string }} WorkplaceProductionPaths */

/** Firebase paths cho báo cáo sản lượng thường (`/normal`). */
export const WORKPLACE_PRODUCTION_PATHS_NORMAL = Object.freeze({
  barRoot: "bar",
  detailsRoot: "details",
  ngRoot: "ng",
  chartOrderKind: CHART_ORDER_KIND.WORKPLACE_AREA,
});

/** Firebase paths riêng cho báo cáo sản lượng S90D. */
export const WORKPLACE_PRODUCTION_PATHS_S90D = Object.freeze({
  barRoot: "s90d/bar",
  detailsRoot: "s90d/details",
  ngRoot: "s90d/ng",
  /** Nhập liệu thủ công + URL ảnh lỗi ImgBB — tách khỏi attendance (phép năm / giấy tăng ca). */
  manualEntriesRoot: "s90d/manualEntries",
  chartOrderKind: CHART_ORDER_KIND.WORKPLACE_AREA_S90D,
});

export const DEFAULT_WORKPLACE_PRODUCTION_PATHS =
  WORKPLACE_PRODUCTION_PATHS_NORMAL;
