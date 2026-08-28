import { describe, expect, it } from "vitest";
import { PERMISSION_IDS } from "@/config/featurePermissions";
import { PERMISSION_CATALOG } from "@/config/featurePermissions";
import {
  inferPermissionRoleLevel,
  filterPermissionCatalog,
  buildPermissionCatalogStats,
  splitModulePath,
  PERMISSION_ROLE_LEVELS,
} from "./permissionCatalogUtils";

describe("permissionCatalogUtils", () => {
  it("inferPermissionRoleLevel detects system-wide access", () => {
    const row = PERMISSION_CATALOG.find(
      (r) => r.id === PERMISSION_IDS.ATTENDANCE_DASHBOARD,
    );
    expect(inferPermissionRoleLevel(row)).toBe(PERMISSION_ROLE_LEVELS.SYSTEM);
  });

  it("inferPermissionRoleLevel detects admin-only rules", () => {
    const row = PERMISSION_CATALOG.find(
      (r) => r.id === PERMISSION_IDS.ATTENDANCE_DELETE,
    );
    expect(inferPermissionRoleLevel(row)).toBe(PERMISSION_ROLE_LEVELS.ADMIN);
  });

  it("filterPermissionCatalog filters by role chip", () => {
    const adminOnly = filterPermissionCatalog(PERMISSION_CATALOG, {
      roleFilters: [PERMISSION_ROLE_LEVELS.ADMIN],
    });
    expect(adminOnly.length).toBeGreaterThan(0);
    expect(
      adminOnly.every(
        (row) =>
          inferPermissionRoleLevel(row) === PERMISSION_ROLE_LEVELS.ADMIN,
      ),
    ).toBe(true);
  });

  it("buildPermissionCatalogStats counts routes and modules", () => {
    const stats = buildPermissionCatalogStats(PERMISSION_CATALOG);
    expect(stats.entries).toBe(PERMISSION_CATALOG.length);
    expect(stats.routes).toBeGreaterThan(0);
    expect(stats.modules).toBeGreaterThan(0);
  });

  it("splitModulePath separates directory and filename", () => {
    expect(
      splitModulePath("features/attendance/AttendanceList.jsx"),
    ).toEqual({
      dir: "features/attendance/",
      name: "AttendanceList.jsx",
    });
    expect(splitModulePath("authRoles.js")).toEqual({
      dir: "",
      name: "authRoles.js",
    });
  });
});
