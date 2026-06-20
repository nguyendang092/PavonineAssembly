import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  annualLeaveEmpFirebaseKey,
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";

describe("annualLeaveEmpKey", () => {
  it("builds emp_{mnv} firebase key", () => {
    expect(annualLeaveEmpFirebaseKey("251205")).toBe("emp_251205");
    expect(annualLeaveEmpFirebaseKey("12")).toBe("emp_12");
  });

  it("resolves canonical key from mnvPrefix", () => {
    expect(
      resolveAnnualLeaveEmpFirebaseKey({
        recordId: "legacy_row_1",
        raw: { [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205" },
      }),
    ).toBe("emp_251205");
  });

  it("indexes year data by emp key preferring canonical path", () => {
    const indexed = indexAnnualLeaveYearByEmpKey({
      legacy_row: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
      },
      emp_251205: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 5,
      },
    });
    expect(indexed.emp_251205.recordId).toBe("emp_251205");
    expect(indexed.emp_251205.raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]).toBe(
      5,
    );
  });
});
