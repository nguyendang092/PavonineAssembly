import { describe, expect, it } from "vitest";
import {
  canExportAttendanceDashboard,
  canPrintAttendanceDashboardReport,
  canViewAttendanceDashboard,
  canViewKoreanTimesheet,
  PERMISSION_CATALOG,
  PERMISSION_IDS,
} from "./featurePermissions";

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

    expect(dashboard?.routes).toEqual(["/attendance-dashboard"]);
    expect(dashboard?.quyTac).toMatch(/Mọi user đã đăng nhập/i);
    expect(list?.routes).not.toContain("/attendance-dashboard");
  });

  it("keeps korean timesheet admin-only", () => {
    expect(canViewKoreanTimesheet(user, "staff")).toBe(false);
  });
});
