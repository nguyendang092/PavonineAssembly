import { describe, expect, it } from "vitest";
import {
  filterPayrollEmployeesByDepartments,
  payrollExportDepartmentFilenameSuffix,
} from "./payrollExportDepartmentFilter.js";

const norm = (v) => String(v ?? "").trim().toLowerCase();

describe("filterPayrollEmployeesByDepartments", () => {
  const employees = [
    { mnv: "1", boPhan: "Assy 1" },
    { mnv: "2", boPhan: "Assy 2" },
    { mnv: "3", boPhan: "QC" },
  ];

  it("returns all when no departments selected", () => {
    expect(
      filterPayrollEmployeesByDepartments(employees, [], norm),
    ).toHaveLength(3);
  });

  it("filters by one or more departments", () => {
    const filtered = filterPayrollEmployeesByDepartments(
      employees,
      ["Assy 1", "QC"],
      norm,
    );
    expect(filtered.map((e) => e.mnv)).toEqual(["1", "3"]);
  });
});

describe("payrollExportDepartmentFilenameSuffix", () => {
  it("returns empty when no filter", () => {
    expect(payrollExportDepartmentFilenameSuffix([])).toBe("");
  });

  it("slugifies single department", () => {
    expect(payrollExportDepartmentFilenameSuffix(["Assy 1"])).toBe("_Assy-1");
  });
});
