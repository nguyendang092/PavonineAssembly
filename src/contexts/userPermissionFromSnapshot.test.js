import { describe, expect, it } from "vitest";
import { ROLES } from "@/config/authRoles";
import {
  departmentsArrayEqual,
  findUserDepartmentMapping,
  resolveUserPermissionFromDepartmentsData,
  userPermissionStateEqual,
} from "@/contexts/userPermissionFromSnapshot";

describe("userPermissionFromSnapshot", () => {
  it("departmentsArrayEqual so sánh theo giá trị", () => {
    expect(departmentsArrayEqual(["A", "B"], ["A", "B"])).toBe(true);
    expect(departmentsArrayEqual(["A"], ["A", "B"])).toBe(false);
    expect(departmentsArrayEqual(["A"], ["B"])).toBe(false);
  });

  it("findUserDepartmentMapping không phân biệt hoa thường email", () => {
    const data = {
      a: { email: "Manager@Example.com", role: ROLES.MANAGER, departments: ["Press"] },
    };
    expect(
      findUserDepartmentMapping(data, { email: "manager@example.com" })?.departments,
    ).toEqual(["Press"]);
  });

  it("resolveUserPermissionFromDepartmentsData trả staff khi không có mapping", () => {
    expect(
      resolveUserPermissionFromDepartmentsData({}, { email: "x@y.com" }),
    ).toEqual({
      userDepartments: [],
      userRole: ROLES.STAFF,
    });
  });

  it("userPermissionStateEqual bỏ qua reference array khác nhau", () => {
    expect(
      userPermissionStateEqual(
        { userRole: ROLES.MANAGER, userDepartments: ["A"] },
        { userRole: ROLES.MANAGER, userDepartments: ["A"] },
      ),
    ).toBe(true);
  });
});
