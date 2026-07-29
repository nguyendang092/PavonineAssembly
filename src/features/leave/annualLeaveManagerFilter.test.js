import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  filterAnnualLeaveManagerRows,
  listAnnualLeaveManagerDepartments,
} from "./annualLeaveManagerFilter";

describe("annualLeaveManagerFilter", () => {
  const rows = [
    {
      id: "emp_1",
      [ANNUAL_LEAVE_EMP.FULL_NAME]: "Nguyen Van A",
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "100",
      [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: "PRESS",
    },
    {
      id: "emp_2",
      [ANNUAL_LEAVE_EMP.FULL_NAME]: "Tran Thi B",
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "200",
      [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: "ASSEMBLY",
    },
  ];

  it("filters by department", () => {
    expect(
      filterAnnualLeaveManagerRows(rows, { deptFilter: "PRESS" }),
    ).toHaveLength(1);
  });

  it("filters by search text", () => {
    expect(
      filterAnnualLeaveManagerRows(rows, { search: "tran" }),
    ).toHaveLength(1);
    expect(
      filterAnnualLeaveManagerRows(rows, { search: "200" }),
    ).toHaveLength(1);
  });

  it("lists unique departments sorted", () => {
    expect(listAnnualLeaveManagerDepartments(rows)).toEqual([
      "ASSEMBLY",
      "PRESS",
    ]);
  });
});
