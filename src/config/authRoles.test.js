import { describe, expect, it } from "vitest";
import {
  canEditLunchOtForEmployee,
  isManagerLunchOtDepartment,
  managerLunchOtDepartmentMatchKey,
} from "./authRoles";

describe("manager lunch OT departments", () => {
  it("nhận Anodizing / Extrusion và EXTRUCSION", () => {
    expect(isManagerLunchOtDepartment("Anodizing")).toBe(true);
    expect(isManagerLunchOtDepartment("ANODIZING")).toBe(true);
    expect(isManagerLunchOtDepartment("Extrusion")).toBe(true);
    expect(isManagerLunchOtDepartment("EXTRUCSION")).toBe(true);
    expect(managerLunchOtDepartmentMatchKey("EXTRUCSION")).toBe("extrusion");
    expect(isManagerLunchOtDepartment("Press")).toBe(false);
  });
});

describe("canEditLunchOtForEmployee", () => {
  const manager = { email: "mgr@pavonine.net" };

  it("manager Anodizing — NV cùng BP", () => {
    expect(
      canEditLunchOtForEmployee({
        user: manager,
        userRole: "manager",
        userDepartments: ["Anodizing"],
        employee: { boPhan: "Anodizing" },
      }),
    ).toBe(true);
  });

  it("manager Extrusion — NV cùng BP", () => {
    expect(
      canEditLunchOtForEmployee({
        user: manager,
        userRole: "manager",
        userDepartments: ["Extrusion"],
        employee: { boPhan: "Extrusion" },
      }),
    ).toBe(true);
  });

  it("manager Press — không được TC trưa", () => {
    expect(
      canEditLunchOtForEmployee({
        user: manager,
        userRole: "manager",
        userDepartments: ["Press"],
        employee: { boPhan: "Press" },
      }),
    ).toBe(false);
  });

  it("manager Anodizing — NV khác BP", () => {
    expect(
      canEditLunchOtForEmployee({
        user: manager,
        userRole: "manager",
        userDepartments: ["Anodizing"],
        employee: { boPhan: "Press" },
      }),
    ).toBe(false);
  });
});
