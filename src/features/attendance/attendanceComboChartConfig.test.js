import { describe, expect, it } from "vitest";
import {
  filterEmployeesByComboDepartment,
  resolveComboChartDepartmentLabel,
} from "./attendanceComboChartConfig";

const normalizeDepartment = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

describe("filterEmployeesByComboDepartment", () => {
  const unknown = "Chưa phân bộ phận";
  const employees = [
    { mnv: "1", boPhan: "ANODIZING" },
    { mnv: "2", boPhan: "Anodizing" },
    { mnv: "3", boPhan: "Nhân sự" },
    { mnv: "4", boPhan: "" },
  ];

  it("groups production aliases onto the chart label", () => {
    const label = resolveComboChartDepartmentLabel(
      normalizeDepartment,
      "ANODIZING",
      unknown,
    );
    expect(label).toBe("Anodizing");
    const rows = filterEmployeesByComboDepartment(
      employees,
      label,
      normalizeDepartment,
      unknown,
    );
    expect(rows.map((e) => e.mnv)).toEqual(["1", "2"]);
  });

  it("keeps unknown-department rows on the unknown label", () => {
    const rows = filterEmployeesByComboDepartment(
      employees,
      unknown,
      normalizeDepartment,
      unknown,
    );
    expect(rows.map((e) => e.mnv)).toEqual(["4"]);
  });

  it("returns the full list when department is empty", () => {
    expect(
      filterEmployeesByComboDepartment(
        employees,
        "",
        normalizeDepartment,
        unknown,
      ),
    ).toEqual(employees);
  });
});
