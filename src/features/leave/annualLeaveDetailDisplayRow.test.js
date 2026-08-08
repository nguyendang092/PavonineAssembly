import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { buildAnnualLeaveDetailDisplayRow } from "./annualLeaveDetailDisplayRow";

describe("buildAnnualLeaveDetailDisplayRow", () => {
  it("keeps live manager totals instead of stale Firebase recompute", () => {
    const row = {
      [ANNUAL_LEAVE_EMP.FULL_NAME]: "Nguyen A",
      [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 9,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 9,
      [ANNUAL_LEAVE_EMP.BALANCE]: 9,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
    };
    const yearRowRaw = {
      [ANNUAL_LEAVE_EMP.FULL_NAME]: "Nguyen A",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
      [ANNUAL_LEAVE_EMP.BALANCE]: 12,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
    };

    const displayRow = buildAnnualLeaveDetailDisplayRow({
      row,
      yearRowRaw,
      selectedYear: 2026,
      openYear: 2026,
      empKey: null,
    });

    expect(displayRow[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(9);
    expect(displayRow[ANNUAL_LEAVE_EMP.BALANCE]).toBe(9);
    expect(displayRow[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]).toBe(0);
  });
});
