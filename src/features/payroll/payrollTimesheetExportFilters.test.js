import { describe, expect, it } from "vitest";
import {
  filterPayrollEmployeesForTimesheetExport,
  hasActivePayrollTimesheetToolbarExportFilters,
} from "./payrollTimesheetExportFilters";
import {
  PAYROLL_SHORT_HOURS_FILTER,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
} from "./payrollMonthTimesheetFilters";

describe("payrollTimesheetExportFilters", () => {
  const rows = [
    {
      id: "1",
      mnv: "001",
      hoVaTen: "An",
      boPhan: "QC",
      gioVao: "08:30",
      gioRa: "16:00",
      caLamViec: "Ca ngày",
      loaiPhep: "",
    },
    {
      id: "2",
      mnv: "002",
      hoVaTen: "Binh",
      boPhan: "MC",
      gioVao: "07:30",
      gioRa: "18:00",
      caLamViec: "Ca ngày",
      loaiPhep: "",
    },
    {
      id: "3",
      mnv: "003",
      hoVaTen: "Chi",
      boPhan: "QC",
      gioVao: "08:30",
      gioRa: "16:00",
      caLamViec: "Ca ngày",
      loaiPhep: "1/2PN",
    },
  ];

  it("detects active toolbar export filters", () => {
    expect(hasActivePayrollTimesheetToolbarExportFilters()).toBe(false);
    expect(
      hasActivePayrollTimesheetToolbarExportFilters({
        shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD,
      }),
    ).toBe(true);
  });

  it("applies short-hours filter and excludes 1/2PN", () => {
    const filtered = filterPayrollEmployeesForTimesheetExport(rows, {
      shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD,
      dayCtx: { dateKey: "2026-07-01" },
    });
    expect(filtered.map((r) => r.mnv)).toEqual(["001"]);
  });

  it("applies search and department filters together", () => {
    const filtered = filterPayrollEmployeesForTimesheetExport(rows, {
      searchTerm: "binh",
      departmentFilter: "MC",
      workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
      dayCtx: { dateKey: "2026-07-01" },
    });
    expect(filtered.map((r) => r.mnv)).toEqual(["002"]);
  });
});
