import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_REGIME,
  employeeRegimeFlagsFromSelectValue,
  getEmployeeRegimeSelectValue,
  hasConflictingEmployeeRegimeFlags,
  resolveEmployeeRegimeFlags,
} from "@/features/attendance/employeeRegime";

describe("employeeRegime", () => {
  it("map dropdown Tài xế / Tài xế tổng", () => {
    expect(employeeRegimeFlagsFromSelectValue(EMPLOYEE_REGIME.TAIXE)).toEqual({
      includeTapVuInWorkingHours: "",
      includeThaiSanInWorkingHours: "",
      includeTaiXeInWorkingHours: "YES",
      includeTaiXeTongInWorkingHours: "",
    });
    expect(
      employeeRegimeFlagsFromSelectValue(EMPLOYEE_REGIME.TAIXETONG),
    ).toEqual({
      includeTapVuInWorkingHours: "",
      includeThaiSanInWorkingHours: "",
      includeTaiXeInWorkingHours: "",
      includeTaiXeTongInWorkingHours: "YES",
    });
  });

  it("đọc lại giá trị select từ bản ghi", () => {
    expect(
      getEmployeeRegimeSelectValue({ includeTaiXeInWorkingHours: "YES" }),
    ).toBe(EMPLOYEE_REGIME.TAIXE);
    expect(
      getEmployeeRegimeSelectValue({
        includeTaiXeTongInWorkingHours: "yes",
      }),
    ).toBe(EMPLOYEE_REGIME.TAIXETONG);
  });

  it("legacy includeTsNvInWorkingHours → cả Tạp vụ + Thai sản (xung đột)", () => {
    const f = resolveEmployeeRegimeFlags({ includeTsNvInWorkingHours: "YES" });
    expect(f.includeTapVuInWorkingHours).toBe(true);
    expect(f.includeThaiSanInWorkingHours).toBe(true);
    expect(hasConflictingEmployeeRegimeFlags({ includeTsNvInWorkingHours: "YES" })).toBe(
      true,
    );
    expect(getEmployeeRegimeSelectValue({ includeTsNvInWorkingHours: "YES" })).toBe(
      "",
    );
  });
});
