/** Route dùng layout sidebar Sản xuất (khớp menu Báo cáo → Sản xuất). */
export const PRODUCTION_LAYOUT_PATHS = [
  "/nhietdo",
  "/mold",
  "/qr-code-generator",
  "/normal",
  "/s90d-production-report",
  "/ap5-production-report",
  "/performance",
  "/stock-variance",
  "/mc-defect-report",
  "/attendance-daily-report",
];

export function isProductionLayoutPath(pathname) {
  return PRODUCTION_LAYOUT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Mục sidebar — `labelKey` = `navbar.*` trong i18n. */
export const PRODUCTION_SIDEBAR_SECTIONS = [
  {
    sectionKey: "productionSidebar.sectionReports",
    sectionDefault: "Tổng hợp báo cáo",
    items: [
      {
        path: "/normal",
        labelKey: "navbar.sanLuong",
        labelDefault: "Báo cáo sản lượng",
        tone: "blue",
      },
      {
        path: "/s90d-production-report",
        labelKey: "navbar.s90dProductionReport",
        labelDefault: "Báo cáo sản lượng S90D",
        tone: "indigo",
      },
      {
        path: "/ap5-production-report",
        labelKey: "navbar.ap5ProductionReport",
        labelDefault: "Báo cáo sản lượng AP5",
        tone: "sky",
      },
      {
        path: "/performance",
        labelKey: "navbar.caiTien",
        labelDefault: "Báo cáo cải tiến",
        tone: "emerald",
      },
      {
        path: "/stock-variance",
        labelKey: "navbar.inventoryDashboard",
        labelDefault: "Báo cáo chênh lệch kiểm kê",
        tone: "teal",
      },
      {
        path: "/mc-defect-report",
        labelKey: "navbar.mcDefectReport",
        labelDefault: "Báo cáo hàng lỗi",
        tone: "rose",
      },
      {
        path: "/attendance-daily-report",
        labelKey: "navbar.attendanceDailyReport",
        labelDefault: "Báo cáo điểm danh ngày",
        tone: "green",
        appendTodayDate: true,
      },
    ],
  },
  {
    sectionKey: "productionSidebar.sectionManagement",
    sectionDefault: "Quản lý",
    items: [
      {
        path: "/nhietdo",
        labelKey: "navbar.nhietdo",
        labelDefault: "Quản lý nhiệt độ",
        tone: "orange",
      },
      {
        path: "/mold",
        labelKey: "navbar.mold",
        labelDefault: "Quản lý khuôn",
        tone: "amber",
      },
      {
        path: "/qr-code-generator",
        labelKey: "navbar.qrCodeGenerator",
        labelDefault: "Quản lý mã QR",
        tone: "violet",
      },
    ],
  },
];
