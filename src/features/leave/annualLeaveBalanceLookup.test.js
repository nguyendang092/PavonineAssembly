import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  buildAnnualLeaveBalanceByMnv,
  getAnnualLeaveBalanceForEmployee,
  getAnnualLeaveBalanceForMnv,
  annualLeaveYearFromDateKey,
} from "./annualLeaveBalanceLookup";

describe("annualLeaveBalanceLookup", () => {
  it("maps combined MNV prefix+suffix to balance", () => {
    const map = buildAnnualLeaveBalanceByMnv({
      emp_PAVO1: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO",
        [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: "1",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
      },
      _meta: { updatedAt: 1 },
    });
    expect(map.PAVO1).toBe(9);
    expect(getAnnualLeaveBalanceForMnv("PAVO 1", map)).toBe(9);
  });

  it("matches attendance split MNV + MVT columns", () => {
    const map = buildAnnualLeaveBalanceByMnv({
      emp_12345: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "12",
        [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: "345",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
      },
    });
    expect(
      getAnnualLeaveBalanceForEmployee({ mnv: "12", mvt: "345" }, map),
    ).toBe(8);
    expect(
      getAnnualLeaveBalanceForEmployee({ mnv: "12345", mvt: "" }, map),
    ).toBe(8);
    expect(
      getAnnualLeaveBalanceForEmployee({ id: "emp_12345", mnv: "12", mvt: "345" }, map),
    ).toBe(8);
  });

  it("parses year from date key", () => {
    expect(annualLeaveYearFromDateKey("2026-06-03")).toBe(2026);
  });
});
