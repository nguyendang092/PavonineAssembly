export const menuConfig = [
  {
    key: "internalAnnouncements",
    label: "navbar.internalAnnouncements",
    /** Trang nội dung; chưa đăng nhập → `/login` */
    path: "/email",
  },
  {
    key: "reports",
    label: "navbar.reports",
    type: "dropdown",
    children: [
      {
        key: "production",
        label: "navbar.production",
        type: "nested",
        children: [
          {
            key: "productionManagement",
            label: "navbar.productionManagement",
            type: "nested",
            children: [
              {
                key: "nhietdo",
                label: "navbar.nhietdo",
                path: "/nhietdo",
              },
              {
                key: "mold",
                label: "navbar.mold",
                path: "/mold",
              },
              {
                key: "qrCodeGenerator",
                label: "navbar.qrCodeGenerator",
                path: "/qr-code-generator",
              },
            ],
          },
          {
            key: "productionReportsSummary",
            label: "navbar.productionReportsSummary",
            type: "nested",
            children: [
              {
                key: "sanLuong",
                label: "navbar.sanLuong",
                path: "/normal",
              },
              {
                key: "caiTien",
                label: "navbar.caiTien",
                path: "/performance",
              },
              {
                key: "inventoryDashboard",
                label: "navbar.inventoryDashboard",
                path: "/stock-variance",
              },
              {
                key: "mcDefectReport",
                label: "navbar.mcDefectReport",
                type: "nested",
                children: [
                  {
                    key: "mc",
                    label: "navbar.mc",
                    path: "/mc-defect-report",
                  },
                ],
              },
            ],
          },
        ],
      },

      {
        key: "hr",
        label: "navbar.hr",
        type: "nested",
        children: [
          {
            key: "hrAttendance",
            label: "navbar.hrAttendance",
            type: "nested",
            children: [
              {
                key: "attendance",
                label: "navbar.attendance",
                type: "nested",
                children: [
                  {
                    key: "attendanceList",
                    label: "navbar.attendanceList",
                    path: "/attendance-list",
                  },
                  {
                    key: "seasonalStaffAttendance",
                    label: "navbar.seasonalStaffAttendance",
                    path: "/seasonal-staff-attendance",
                  },
                ],
              },
              {
                key: "annualLeave",
                label: "navbar.annualLeave",
                path: "/annual-leave",
              },
              {
                key: "attendanceSalary",
                label: "navbar.attendanceSalaryTitle",
                type: "nested",
                children: [
                  {
                    key: "attendanceSalary",
                    label: "navbar.attendanceSalary",
                    path: "/attendance-salary",
                  },
                ],
              },
            ],
          },
          {
            key: "certificate",
            label: "navbar.certificate",
            type: "nested",
            adminOnly: true,
            children: [
              {
                key: "certificate1",
                label: "navbar.certificate1",
                path: "/bangkhen1",
              },
              {
                key: "certificate2",
                label: "navbar.certificate2",
                path: "/bangkhen2",
              },
              {
                key: "honorBoard",
                label: "navbar.honorBoard",
                path: "/honor-board",
              },
            ],
          },
        ],
      },

      {
        key: "download",
        label: "navbar.download",
        type: "nested",
        children: [
          {
            key: "files",
            label: "navbar.files",
            path: "/downloads",
          },
        ],
      },
    ],
  },
];

/** Không bọc ProtectedRoute — dùng cho App.jsx */
export const PUBLIC_ROUTE_PATHS = new Set(["/login", "/email/login"]);

// Cấu hình route cho App.jsx (route công khai /login, /email/login khai báo trực tiếp trong App)
export const routeConfig = [
  { path: "/", element: "InternalAnnouncements" },
  { path: "/normal", element: "WorkplaceDashboardNormal" },
  { path: "/bangkhen1", element: "CertificateGenerator1" },
  { path: "/bangkhen2", element: "CertificateGenerator2" },
  { path: "/honor-board", element: "HonorBoard" },
  { path: "/nhietdo", element: "TemperatureMonitor" },
  { path: "/mold", element: "MoldManager" },
  { path: "/performance", element: "PerformanceChart" },
  { path: "/qr-code-generator", element: "QRCodeGenerator" },
  { path: "/stock-variance", element: "WarehouseInventoryDashboard" },
  { path: "/mc-defect-report", element: "MCDefectReportDashboard" },
  { path: "/attendance-list", element: "AttendanceList" },
  { path: "/seasonal-staff-attendance", element: "SeasonalStaffAttendance" },
  { path: "/attendance-salary", element: "PayrollSalaryCalculator" },
  { path: "/annual-leave", element: "AnnualLeaveManager" },
  { path: "/user-department", element: "UserDepartmentManager" },
  { path: "/permission-catalog", element: "PermissionCatalogPage" },
  { path: "/email", element: "InternalAnnouncements" },
  { path: "/downloads", element: "Downloads" },
];
