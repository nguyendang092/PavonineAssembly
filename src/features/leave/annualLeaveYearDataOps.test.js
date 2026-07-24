import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP, ANNUAL_LEAVE_META_KEY } from "./annualLeaveFields";
import {
  buildAnnualLeaveMergeUploadUpdates,
  countAnnualLeaveEmployeesInYearData,
} from "./annualLeaveYearDataOps";

describe("annualLeaveYearDataOps", () => {
  it("counts employees excluding meta", () => {
    expect(
      countAnnualLeaveEmployeesInYearData({
        [ANNUAL_LEAVE_META_KEY]: { rowCount: 2 },
        "emp_001": { mnvPrefix: "001" },
        "emp_002": { mnvPrefix: "002" },
      }),
    ).toBe(2);
  });

  it("merges upload without dropping employees missing from Excel", () => {
    const existing = {
      [ANNUAL_LEAVE_META_KEY]: { rowCount: 2 },
      "emp_001": { [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "001" },
      "emp_002": { [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "002" },
    };
    const { updates, mergedCount, importedCount } =
      buildAnnualLeaveMergeUploadUpdates({
        year: 2026,
        records: [
          {
            id: "emp_001",
            rowNo: "1",
            [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "001",
            [ANNUAL_LEAVE_EMP.FULL_NAME]: "Updated",
          },
        ],
        existingYearData: existing,
        updatedBy: "hr@test.com",
      });

    expect(importedCount).toBe(1);
    expect(mergedCount).toBe(2);
    expect(updates["annualLeave/2026/emp_001"]).toMatchObject({
      id: "emp_001",
      fullName: "Updated",
    });
    expect(updates["annualLeave/2026/emp_002"]).toBeUndefined();
    expect(updates["annualLeave/2026/_meta"]).toMatchObject({
      rowCount: 2,
      updatedBy: "hr@test.com",
    });
  });
});
