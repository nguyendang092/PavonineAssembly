import { describe, expect, it } from "vitest";
import { PAYROLL_EMP } from "./payrollEmployeeFields";
import {
  resolveEffectivePayrollNightOtPaperwork,
  sanitizeNightOtPaperworkById,
} from "./payrollNightOtMeta";

describe("payrollNightOtMeta", () => {
  it("resolveEffectivePayrollNightOtPaperwork requires 22:00–05:00 entry", () => {
    const emp = {
      [PAYROLL_EMP.TIME_IN]: "22:00",
      [PAYROLL_EMP.SHIFT]: "S1",
    };
    expect(resolveEffectivePayrollNightOtPaperwork(emp, true)).toBe(true);
    expect(
      resolveEffectivePayrollNightOtPaperwork(
        { ...emp, [PAYROLL_EMP.TIME_IN]: "18:40" },
        true,
      ),
    ).toBeUndefined();
    expect(resolveEffectivePayrollNightOtPaperwork(emp, false)).toBeUndefined();
  });

  it("sanitizeNightOtPaperworkById drops ineligible rows", () => {
    const employees = [
      { id: "a", [PAYROLL_EMP.TIME_IN]: "22:00", [PAYROLL_EMP.SHIFT]: "S2" },
      { id: "b", [PAYROLL_EMP.TIME_IN]: "08:00", [PAYROLL_EMP.SHIFT]: "S2" },
    ];
    expect(
      sanitizeNightOtPaperworkById({ a: true, b: true }, employees),
    ).toEqual({ a: true });
  });
});
