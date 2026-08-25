/** Route dùng layout sidebar Sản xuất (menu ứng dụng thống nhất). */
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
  "/attendance-list",
  "/seasonal-staff-attendance",
  "/attendance-salary",
  "/annual-leave",
  "/attendance-dashboard",
  "/korean-timesheet",
  "/bangkhen1",
  "/bangkhen2",
  "/user-department",
  "/permission-catalog",
];

export function isProductionLayoutPath(pathname) {
  return PRODUCTION_LAYOUT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Mục sidebar — `labelKey` = i18n (navbar.* hoặc attendanceList.*). */
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
    sectionDefault: "Quản lý sản xuất",
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
  {
    sectionKey: "productionSidebar.sectionHr",
    sectionDefault: "Nhân sự",
    items: [
      {
        path: "/attendance-list",
        labelKey: "attendanceList.sidebarAttendance",
        labelDefault: "Điểm danh",
        tone: "blue",
      },
      {
        path: "/seasonal-staff-attendance",
        labelKey: "attendanceList.sidebarSeasonal",
        labelDefault: "Thời vụ",
        tone: "teal",
        appendTodayDate: true,
      },
      {
        path: "/attendance-salary",
        labelKey: "attendanceList.sidebarWorkHours",
        labelDefault: "Giờ công",
        tone: "emerald",
        resolvePayrollPath: true,
      },
      {
        path: "/annual-leave",
        labelKey: "attendanceList.sidebarAnnualLeave",
        labelDefault: "Phép năm",
        tone: "amber",
        resolveAnnualLeavePath: true,
      },
      {
        path: "/attendance-dashboard",
        labelKey: "attendanceList.sidebarDashboard",
        labelDefault: "Dashboard",
        tone: "indigo",
        appendTodayDate: true,
      },
      {
        path: "/korean-timesheet",
        labelKey: "attendanceList.sidebarKoreanTimesheet",
        labelDefault: "Korean Timesheet",
        tone: "sky",
        appendTodayDate: true,
        koreanOnly: true,
      },
    ],
  },
  {
    sectionKey: "productionSidebar.sectionInventory",
    sectionDefault: "Kiểm kê",
    items: [
      {
        path: "/stock-variance",
        labelKey: "navbar.inventoryDashboard",
        labelDefault: "Báo cáo chênh lệch kiểm kê",
        tone: "teal",
      },
    ],
  },
  {
    sectionKey: "productionSidebar.sectionOther",
    sectionDefault: "Khác",
    items: [
      {
        path: "/bangkhen1",
        labelKey: "navbar.certificate1",
        labelDefault: "Bằng khen ưu tú nhất",
        tone: "violet",
        adminOnly: true,
      },
      {
        path: "/bangkhen2",
        labelKey: "navbar.certificate2",
        labelDefault: "Bằng khen ưu tú",
        tone: "rose",
        adminOnly: true,
      },
    ],
  },
  {
    sectionKey: "productionSidebar.sectionSystem",
    sectionDefault: "Hệ thống",
    items: [
      {
        path: "/user-department",
        labelKey: "navbar.userDepartment",
        labelDefault: "Phân quyền User",
        tone: "indigo",
        adminOnly: true,
      },
      {
        path: "/permission-catalog",
        labelKey: "navbar.permissionCatalog",
        labelDefault: "Phân quyền & chức năng",
        tone: "sky",
        adminOnly: true,
      },
    ],
  },
];
