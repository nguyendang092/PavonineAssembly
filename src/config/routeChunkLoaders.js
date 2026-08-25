/** Dynamic import theo path — Vite dedupe chunk với lazyImport trong App.jsx. */
export const ROUTE_CHUNK_LOADERS = {
  "/normal": () => import("@/features/dashboard/WorkplaceDashboardNormal"),
  "/s90d-production-report": () =>
    import("@/features/dashboard/S90DProductionReportPage"),
  "/ap5-production-report": () =>
    import("@/features/dashboard/AP5ProductionReportPage"),
  "/bangkhen1": () => import("@/components/ui/CertificateGenerator1"),
  "/bangkhen2": () => import("@/components/ui/CertificateGenerator2"),
  "/nhietdo": () => import("@/components/ui/TemperatureMonitor"),
  "/mold": () => import("@/features/inventory/MoldManager"),
  "/performance": () => import("@/features/dashboard/PerformanceChart"),
  "/qr-code-generator": () => import("@/components/ui/QRCodeGenerator"),
  "/stock-variance": () => import("@/features/dashboard/warehouseInventory"),
  "/mc-defect-report": () => import("@/features/dashboard/mcDefectReport"),
  "/attendance-list": () => import("@/features/attendance/AttendanceList"),
  "/korean-timesheet": () => import("@/features/attendance/KoreanTimesheetPage"),
  "/seasonal-staff-attendance": () =>
    import("@/features/attendance/SeasonalStaffAttendance"),
  "/attendance-salary": () => import("@/features/payroll/PayrollSalaryCalculator"),
  "/annual-leave": () => import("@/features/leave/AnnualLeaveManager"),
  "/attendance-dashboard": () =>
    import("@/features/attendance/AttendanceDashboardPage"),
  "/attendance-daily-report": () =>
    import("@/features/attendance/AttendanceDailyReportPage"),
  "/user-department": () => import("@/features/employee/UserDepartmentManager"),
  "/permission-catalog": () => import("@/features/admin/PermissionCatalogPage"),
};

const prefetchedPaths = new Set();

export function routePathFromTo(to) {
  if (typeof to === "string") {
    return to.split("?")[0];
  }
  if (to && typeof to === "object" && typeof to.pathname === "string") {
    return to.pathname;
  }
  return "";
}

export function prefetchRouteChunk(to) {
  const path = routePathFromTo(to);
  if (!path) return;

  const loader = ROUTE_CHUNK_LOADERS[path];
  if (!loader || prefetchedPaths.has(path)) return;

  prefetchedPaths.add(path);
  void loader().catch(() => {
    prefetchedPaths.delete(path);
  });
}
