import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as authRoles from "./authRoles";
import {
  canExportAttendanceDashboard,
  canPrintAttendanceDashboardReport,
  canViewAttendanceDashboard,
  canViewKoreanTimesheet,
  PERMISSION_CATALOG,
  PERMISSION_IDS,
} from "./featurePermissions";
import { ROUTE_CHUNK_LOADERS } from "./routeChunkLoaders";

const projectRoot = join(import.meta.dirname, "..", "..");

describe("featurePermissions attendance dashboard", () => {
  const user = { email: "staff@example.com", name: "Staff" };

  it("allows any logged-in user to view, export, and print dashboard", () => {
    expect(canViewAttendanceDashboard(user)).toBe(true);
    expect(canExportAttendanceDashboard(user)).toBe(true);
    expect(canPrintAttendanceDashboardReport(user)).toBe(true);
    expect(canViewAttendanceDashboard(null)).toBe(false);
  });

  it("registers dashboard as open-access permission separate from attendance list", () => {
    const dashboard = PERMISSION_CATALOG.find(
      (row) => row.id === PERMISSION_IDS.ATTENDANCE_DASHBOARD,
    );
    const list = PERMISSION_CATALOG.find(
      (row) => row.id === PERMISSION_IDS.ATTENDANCE_LIST,
    );

    expect(dashboard?.routes).toEqual([
      "/attendance-dashboard",
      "/attendance-daily-report",
    ]);
    expect(dashboard?.quyTac).toMatch(/thống kê điểm danh/i);
    expect(list?.routes).not.toContain("/attendance-dashboard");
  });

  it("keeps korean timesheet admin-only", () => {
    expect(canViewKoreanTimesheet(user, "staff")).toBe(false);
  });
});

describe("PERMISSION_CATALOG integrity", () => {
  it("registers every route against routeChunkLoaders", () => {
    for (const row of PERMISSION_CATALOG) {
      for (const route of row.routes) {
        expect(
          ROUTE_CHUNK_LOADERS[route],
          `${row.id} route ${route}`,
        ).toBeDefined();
      }
    }
  });

  it("does not reference stale /payroll-salary paths", () => {
    const stale = PERMISSION_CATALOG.flatMap((row) =>
      row.routes.filter((route) => route === "/payroll-salary"),
    );
    expect(stale).toEqual([]);
  });

  it("lists module files that exist under src/", () => {
    for (const row of PERMISSION_CATALOG) {
      for (const mod of row.modules) {
        expect(
          existsSync(join(projectRoot, "src", mod)),
          `${row.id} module ${mod}`,
        ).toBe(true);
      }
    }
  });

  it("lists authRolesHelpers exported from authRoles or featurePermissions", () => {
    const featurePermissionExports = new Set([
      "canViewKoreanTimesheet",
      "canViewAttendanceDashboard",
      "canExportAttendanceDashboard",
      "canPrintAttendanceDashboardReport",
      "canEditPayrollMonthTimesheetGridCell",
      "debugPrintPermissionCatalog",
      "PERMISSION_CATALOG",
      "PERMISSION_IDS",
    ]);

    for (const row of PERMISSION_CATALOG) {
      for (const helper of row.authRolesHelpers) {
        const inAuthRoles = helper in authRoles;
        const inFeaturePermissions = featurePermissionExports.has(helper);
        expect(
          inAuthRoles || inFeaturePermissions,
          `${row.id} helper ${helper}`,
        ).toBe(true);
      }
    }
  });

  it("registers annual leave management", () => {
    const annualLeave = PERMISSION_CATALOG.find(
      (row) => row.id === PERMISSION_IDS.ANNUAL_LEAVE,
    );
    expect(annualLeave?.routes).toEqual(["/annual-leave"]);
    expect(annualLeave?.authRolesHelpers).toContain("canManageAnnualLeave");
  });

  it("uses /attendance-salary for off-holiday days on payroll page", () => {
    const offDays = PERMISSION_CATALOG.find(
      (row) => row.id === PERMISSION_IDS.ATTENDANCE_OFF_HOLIDAY_DAYS,
    );
    expect(offDays?.routes).toContain("/attendance-salary");
    expect(offDays?.routes).not.toContain("/payroll-salary");
  });
});
