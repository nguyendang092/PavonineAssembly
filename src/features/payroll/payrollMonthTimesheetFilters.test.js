import { describe, expect, it } from "vitest";
import {
  buildPayrollMonthTimesheetFlagsById,
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  needsPayrollMonthTimesheetPresenceFlags,
} from "./payrollMonthTimesheetFilters";

describe("payrollMonthTimesheetFilters", () => {
  it("matches work hours and leave filters", () => {
    const flags = { hasWorkHours: true, hasLeaveType: false };
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flags, {
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
        leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
      }),
    ).toBe(true);
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flags, {
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
      }),
    ).toBe(false);
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flags, {
        leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
      }),
    ).toBe(false);
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flags, {
        leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
      }),
    ).toBe(true);
  });

  it("detects presence flags from month chunks", () => {
    const monthKeys = ["2026-07-01", "2026-07-02"];
    const chunkByDate = new Map([
      [
        "2026-07-01",
        {
          employees: [
            {
              id: "emp-1",
              mnv: "001",
              hoVaTen: "A",
              gioVao: "07:30",
              gioRa: "16:30",
              caLamViec: "Ca ngày",
              loaiPhep: "",
            },
          ],
          byId: new Map([
            [
              "emp-1",
              {
                id: "emp-1",
                mnv: "001",
                hoVaTen: "A",
                gioVao: "07:30",
                gioRa: "16:30",
                caLamViec: "Ca ngày",
                loaiPhep: "",
              },
            ],
          ]),
          rowLookup: new Map(),
          byMonthEmployeeKey: new Map(),
        },
      ],
      [
        "2026-07-02",
        {
          employees: [
            {
              id: "emp-1",
              mnv: "001",
              hoVaTen: "A",
              gioVao: "",
              gioRa: "",
              caLamViec: "Ca ngày",
              loaiPhep: "Phép năm",
            },
          ],
          byId: new Map([
            [
              "emp-1",
              {
                id: "emp-1",
                mnv: "001",
                hoVaTen: "A",
                gioVao: "",
                gioRa: "",
                caLamViec: "Ca ngày",
                loaiPhep: "Phép năm",
              },
            ],
          ]),
          rowLookup: new Map(),
          byMonthEmployeeKey: new Map(),
        },
      ],
    ]);
    const repById = new Map([
      [
        "001",
        {
          id: "emp-1",
          mnv: "001",
          hoVaTen: "A",
          ngayVaoLam: "2026-01-01",
        },
      ],
    ]);

    const flagsById = buildPayrollMonthTimesheetFlagsById({
      monthKeys,
      chunkByDate,
      sortedIds: ["001"],
      repById,
    });

    expect(flagsById.get("001")).toEqual({
      hasWorkHours: true,
      hasLeaveType: true,
      hasOvertime: false,
    });
  });

  it("needs presence flags only when filter active", () => {
    expect(needsPayrollMonthTimesheetPresenceFlags()).toBe(false);
    expect(
      needsPayrollMonthTimesheetPresenceFlags({
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
      }),
    ).toBe(true);
  });
});
