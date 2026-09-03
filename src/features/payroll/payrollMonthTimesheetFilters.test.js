import { describe, expect, it } from "vitest";
import { ATTENDANCE_LEAVE_FILTER_NONE } from "@/features/attendance/attendanceListShared";
import {
  buildPayrollMonthTimesheetFlagsById,
  countActivePayrollTimesheetPresenceFilters,
  matchesPayrollLeaveTypeFilter,
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
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

  it("matches specific attendance leave types in month", () => {
    const flags = {
      hasLeaveType: true,
      hasLeaveTypeNone: true,
      leaveTypeValues: new Set(["Phép năm", "Không lương"]),
    };
    expect(
      matchesPayrollLeaveTypeFilter(flags, PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL),
    ).toBe(true);
    expect(matchesPayrollLeaveTypeFilter(flags, "Phép năm")).toBe(true);
    expect(matchesPayrollLeaveTypeFilter(flags, "Phép ốm")).toBe(false);
    expect(
      matchesPayrollLeaveTypeFilter(flags, ATTENDANCE_LEAVE_FILTER_NONE),
    ).toBe(true);
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flags, {
        leaveTypeFilter: "Không lương",
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

    expect(flagsById.get("001")).toMatchObject({
      hasWorkHours: true,
      hasLeaveType: true,
      hasLeaveTypeNone: true,
      hasOvertime: false,
      hasShortHours: true,
      hasNightShift: false,
    });
    expect(flagsById.get("001")?.leaveTypeValues).toEqual(
      new Set(["Phép năm"]),
    );
  });

  it("detects short hours from month chunks", () => {
    const monthKeys = ["2026-07-01"];
    const chunkByDate = new Map([
      [
        "2026-07-01",
        {
          employees: [
            {
              id: "emp-2",
              mnv: "002",
              hoVaTen: "B",
              gioVao: "08:30",
              gioRa: "16:00",
              caLamViec: "Ca ngày",
              loaiPhep: "",
            },
          ],
          byId: new Map([
            [
              "emp-2",
              {
                id: "emp-2",
                mnv: "002",
                hoVaTen: "B",
                gioVao: "08:30",
                gioRa: "16:00",
                caLamViec: "Ca ngày",
                loaiPhep: "",
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
        "002",
        {
          id: "emp-2",
          mnv: "002",
          hoVaTen: "B",
          ngayVaoLam: "2026-01-01",
        },
      ],
    ]);

    const flagsById = buildPayrollMonthTimesheetFlagsById({
      monthKeys,
      chunkByDate,
      sortedIds: ["002"],
      repById,
    });

    expect(flagsById.get("002")).toMatchObject({
      hasWorkHours: true,
      hasLeaveType: false,
      hasLeaveTypeNone: true,
      hasOvertime: false,
      hasShortHours: true,
      hasNightShift: false,
    });
    expect(flagsById.get("002")?.leaveTypeValues?.size).toBe(0);
  });

  it("excludes 1/2PN from short-hours flag", () => {
    const monthKeys = ["2026-07-01"];
    const chunkByDate = new Map([
      [
        "2026-07-01",
        {
          employees: [
            {
              id: "emp-3",
              mnv: "003",
              hoVaTen: "C",
              gioVao: "08:30",
              gioRa: "16:00",
              caLamViec: "Ca ngày",
              loaiPhep: "1/2PN",
            },
          ],
          byId: new Map([
            [
              "emp-3",
              {
                id: "emp-3",
                mnv: "003",
                hoVaTen: "C",
                gioVao: "08:30",
                gioRa: "16:00",
                caLamViec: "Ca ngày",
                loaiPhep: "1/2PN",
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
        "003",
        {
          id: "emp-3",
          mnv: "003",
          hoVaTen: "C",
          ngayVaoLam: "2026-01-01",
        },
      ],
    ]);

    const flagsById = buildPayrollMonthTimesheetFlagsById({
      monthKeys,
      chunkByDate,
      sortedIds: ["003"],
      repById,
    });

    expect(flagsById.get("003")).toMatchObject({
      hasWorkHours: true,
      hasLeaveType: true,
      hasLeaveTypeNone: false,
      hasOvertime: false,
      hasShortHours: false,
      hasNightShift: false,
    });
    expect(flagsById.get("003")?.leaveTypeValues).toEqual(
      new Set(["1/2 Phép năm"]),
    );
  });

  it("detects night shift S2 from month chunks", () => {
    const monthKeys = ["2026-08-01"];
    const chunkByDate = new Map([
      [
        "2026-08-01",
        {
          employees: [
            {
              id: "emp-4",
              mnv: "004",
              hoVaTen: "D",
              gioVao: "22:00",
              gioRa: "06:00",
              caLamViec: "S2",
              loaiPhep: "",
            },
          ],
          byId: new Map([
            [
              "emp-4",
              {
                id: "emp-4",
                mnv: "004",
                hoVaTen: "D",
                gioVao: "22:00",
                gioRa: "06:00",
                caLamViec: "S2",
                loaiPhep: "",
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
        "004",
        {
          id: "emp-4",
          mnv: "004",
          hoVaTen: "D",
          ngayVaoLam: "2026-01-01",
        },
      ],
    ]);

    const flagsById = buildPayrollMonthTimesheetFlagsById({
      monthKeys,
      chunkByDate,
      sortedIds: ["004"],
      repById,
    });

    expect(flagsById.get("004")).toMatchObject({
      hasNightShift: true,
    });
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flagsById.get("004"), {
        nightShiftFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
      }),
    ).toBe(true);
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(flagsById.get("004"), {
        nightShiftFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
      }),
    ).toBe(false);
  });

  it("needs presence flags only when filter active", () => {
    expect(needsPayrollMonthTimesheetPresenceFlags()).toBe(false);
    expect(
      needsPayrollMonthTimesheetPresenceFlags({
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
      }),
    ).toBe(true);
    expect(
      needsPayrollMonthTimesheetPresenceFlags({
        shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD,
      }),
    ).toBe(true);
  });

  it("countActivePayrollTimesheetPresenceFilters — badge số bộ lọc đang bật", () => {
    expect(countActivePayrollTimesheetPresenceFilters()).toBe(0);
    expect(
      countActivePayrollTimesheetPresenceFilters({
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
        leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
      }),
    ).toBe(2);
    expect(
      countActivePayrollTimesheetPresenceFilters({
        workHoursFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
        leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH,
        overtimeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITHOUT,
        shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD,
      }),
    ).toBe(4);
  });
});
