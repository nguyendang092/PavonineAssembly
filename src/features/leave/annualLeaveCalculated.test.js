import { describe, expect, it } from "vitest";
import { computeAnnualLeaveTotals } from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

describe("computeAnnualLeaveTotals", () => {
  it("tổng = phép năm + bonus + nghỉ bù; balance = tổng - đã dùng", () => {
    const row = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 7,
      [ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]: 0,
      [ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]: 0,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3.5,
    };
    const t = computeAnnualLeaveTotals(row);
    expect(t[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(7);
    expect(t[ANNUAL_LEAVE_EMP.BALANCE]).toBe(3.5);
  });
});
