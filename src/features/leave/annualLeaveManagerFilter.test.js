import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  buildAnnualLeaveManagerRowCatalog,
  filterAnnualLeaveManagerRows,
  listAnnualLeaveManagerDepartments,
  resolveAnnualLeaveManagerTableEntries,
  shouldRequireAnnualLeaveManagerDeptScope,
} from "./annualLeaveManagerFilter";
import { ANNUAL_LEAVE_MANAGER_LAZY_LOAD_THRESHOLD } from "./annualLeaveFields";

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
    expect(filterAnnualLeaveManagerRows(rows, { search: "tran" })).toHaveLength(
      1,
    );
    expect(filterAnnualLeaveManagerRows(rows, { search: "200" })).toHaveLength(
      1,
    );
  });

  it("lists unique departments sorted", () => {
    expect(listAnnualLeaveManagerDepartments(rows)).toEqual([
      "ASSEMBLY",
      "PRESS",
    ]);
  });

  it("builds row catalog in one pass", () => {
    const catalog = buildAnnualLeaveManagerRowCatalog({
      emp_1: {
        rowNo: 1,
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "100",
        [ANNUAL_LEAVE_EMP.FULL_NAME]: "Nguyen Van A",
        [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: "PRESS",
      },
      emp_2: {
        rowNo: 2,
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "200",
        [ANNUAL_LEAVE_EMP.FULL_NAME]: "Tran Thi B",
        [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: "ASSEMBLY",
      },
    });
    expect(catalog.entries).toHaveLength(2);
    expect(catalog.departments).toEqual(["ASSEMBLY", "PRESS"]);
    expect(catalog.deptIndex.get("PRESS")).toHaveLength(1);
  });

  it("requires dept scope when employee count exceeds threshold", () => {
    expect(
      shouldRequireAnnualLeaveManagerDeptScope(
        ANNUAL_LEAVE_MANAGER_LAZY_LOAD_THRESHOLD + 1,
        {},
      ),
    ).toBe(true);
    expect(
      shouldRequireAnnualLeaveManagerDeptScope(
        ANNUAL_LEAVE_MANAGER_LAZY_LOAD_THRESHOLD + 1,
        { deptFilter: "PRESS" },
      ),
    ).toBe(false);
    expect(
      shouldRequireAnnualLeaveManagerDeptScope(
        ANNUAL_LEAVE_MANAGER_LAZY_LOAD_THRESHOLD + 1,
        { search: "100" },
      ),
    ).toBe(false);
  });

  it("resolveAnnualLeaveManagerTableEntries returns empty when lazy required", () => {
    const bigEntries = Array.from(
      { length: ANNUAL_LEAVE_MANAGER_LAZY_LOAD_THRESHOLD + 1 },
      (_, i) => ({
        id: `emp_${i}`,
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: String(i),
        [ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]: "PRESS",
      }),
    );
    const { entries, lazyLoadRequired } = resolveAnnualLeaveManagerTableEntries(
      bigEntries,
      {},
      new Map([["PRESS", bigEntries]]),
    );
    expect(lazyLoadRequired).toBe(true);
    expect(entries).toHaveLength(0);
  });
});
