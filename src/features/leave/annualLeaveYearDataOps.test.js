import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP, ANNUAL_LEAVE_META_KEY } from "./annualLeaveFields";
import { buildAnnualLeaveMergeUploadUpdates } from "./annualLeaveYearDataOps";

describe("annualLeaveYearDataOps", () => {
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

  it("keeps existing usage, monthly breakdown, and adjustment when Excel has zeros", () => {
    const monthly = [1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const existing = {
      [ANNUAL_LEAVE_META_KEY]: { rowCount: 1 },
      emp_001: {
        id: "emp_001",
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "001",
        [ANNUAL_LEAVE_EMP.FULL_NAME]: "Old",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 2,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 5,
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 5,
        [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: monthly,
        [ANNUAL_LEAVE_EMP.BALANCE]: 10,
      },
    };

    const { updates, newEmpKeys } = buildAnnualLeaveMergeUploadUpdates({
      year: 2026,
      records: [
        {
          id: "emp_001",
          rowNo: "1",
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "001",
          [ANNUAL_LEAVE_EMP.FULL_NAME]: "New Name",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
          [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 0,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 0,
          [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: Array(12).fill(0),
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 0,
          [ANNUAL_LEAVE_EMP.BALANCE]: 0,
        },
      ],
      existingYearData: existing,
      updatedBy: "hr@test.com",
    });

    expect(newEmpKeys).toEqual([]);
    expect(updates["annualLeave/2026/emp_001"]).toMatchObject({
      fullName: "New Name",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 2,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 5,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 5,
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 1,
      [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: monthly,
      [ANNUAL_LEAVE_EMP.BALANCE]: 10,
    });
  });

  it("adds employees that are only in Excel without wiping others", () => {
    const existing = {
      [ANNUAL_LEAVE_META_KEY]: { rowCount: 1 },
      emp_001: { [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "001" },
    };
    const { updates, newEmpKeys, mergedCount } =
      buildAnnualLeaveMergeUploadUpdates({
        year: 2026,
        records: [
          {
            id: "emp_009",
            [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "009",
            [ANNUAL_LEAVE_EMP.FULL_NAME]: "Moi",
            [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: Array(12).fill(0),
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
          },
        ],
        existingYearData: existing,
        updatedBy: "hr@test.com",
      });

    expect(newEmpKeys).toEqual(["emp_009"]);
    expect(mergedCount).toBe(2);
    expect(updates["annualLeave/2026/emp_001"]).toBeUndefined();
    expect(updates["annualLeave/2026/emp_009"]).toMatchObject({
      fullName: "Moi",
      mnvPrefix: "009",
    });
    expect(
      updates["annualLeave/2026/emp_009"][ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE],
    ).toBeUndefined();
    expect(
      updates["annualLeave/2026/emp_009"][ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
    ).toBeUndefined();
  });
});
