export const menuConfig = [
  {
    key: "home",
    label: "navbar.home",
    path: "/",
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
            key: "sanLuong",
            label: "navbar.sanLuong",
            type: "nested",
            children: [
              {
                key: "sanLuongNormal",
                label: "navbar.Normal",
                path: "/normal",
              },
              {
                key: "sanLuongNG",
                label: "navbar.ng",
                path: "/ng",
              },
            ],
          },
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
            key: "caiTien",
            label: "navbar.caiTien",
            path: "/performance",
          },
          {
            key: "qrCodeGenerator",
            label: "navbar.qrCodeGenerator",
            path: "/qr-code-generator",
          },
        ],
      },

      {
        key: "hr",
        label: "navbar.hr",
        type: "nested",
        children: [
          {
            key: "ADMIN",
            label: "navbar.ADMIN",
            type: "nested",
            children: [
              {
                key: "attendance",
                label: "navbar.attendance",
                path: "/attendance-list",
              },
              {
                key: "attendanceDashboard",
                label: "navbar.attendanceDashboard",
                path: "/attendance-dashboard",
              },
              {
                key: "attendanceTable",
                label: "navbar.attendanceTable",
                path: "/attendance-table",
              },
              {
                key: "userDepartment",
                label: "navbar.userDepartment",
                path: "/user-department",
                adminOnly: true,
              },
            ],
          },
          {
            key: "GA",
            label: "navbar.GA",
            type: "nested",
            children: [
              {
                key: "maintenance",
                label: "navbar.maintenance",
                path: "/maintenance",
              },
              {
                key: "driverLogbook",
                label: "navbar.driverLogbook",
                path: "/driver-logbook",
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
            ],
          },
          {
            key: "honorBoard",
            label: "navbar.honorBoard",
            path: "/honor-board",
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

// Cấu hình route cho App.jsx
export const routeConfig = [
  { path: "/normal", element: "WorkplaceChart" },
  { path: "/ng", element: "NGWorkplaceChart" },
  // { path: "/ap5md/ap5mdff", element: "Metandeco" },
  // { path: "/ap5md/ap5mdfz", element: "Metandeco" },
  // {path: "/ap5md/ap5mdfl", element: "Metandeco" },
  // { path: "/ap5/ap5ff", element: "Metandeco" },
  // { path: "/ap5/ap5fz", element: "Metandeco" },
  { path: "/bangkhen1", element: "CertificateGenerator1" },
  { path: "/bangkhen2", element: "CertificateGenerator2" },
  { path: "/honor-board", element: "HonorBoard" },
  { path: "/nhietdo", element: "TemperatureMonitor" },
  { path: "/employ", element: "Employ" },
  { path: "/employ/:leader", element: "Employ" },
  { path: "/mold", element: "MoldManager" },
  { path: "/performance", element: "PerformanceChart" },
  { path: "/qr-code-generator", element: "QRCodeGenerator" },
  { path: "/attendance-list", element: "AttendanceList" },
  { path: "/attendance-dashboard", element: "AttendanceDashboard" },
  { path: "/attendance-table", element: "AttendanceTable" },
  { path: "/user-department", element: "UserDepartmentManager" },
  { path: "/inventory", element: "Inventory" },
  { path: "/downloads", element: "Downloads" },
  { path: "/maintenance", element: "MaintenanceChecklist" },
  { path: "/driver-logbook", element: "DriverLogbook" },
];
