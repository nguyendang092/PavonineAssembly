import { describe, expect, it } from "vitest";
import {
  getAttendanceDayEmployeePresenceFlags,
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
} from "./attendanceDayPresenceFilters";

describe("attendanceDayPresenceFilters", () => {
  it("detects leave, work hours and overtime for a day row", () => {
    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "07:30",
        gioRa: "16:30",
        caLamViec: "Ca ngày",
        loaiPhep: "",
      }),
    ).toEqual({
      hasWorkHours: true,
      hasLeaveType: false,
      hasLeaveTypeNone: true,
      leaveTypeRaw: "",
      hasOvertime: false,
      hasShortHours: true,
    });

    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "",
        gioRa: "",
        caLamViec: "Ca ngày",
        loaiPhep: "Phép năm",
      }),
    ).toEqual({
      hasWorkHours: false,
      hasLeaveType: true,
      hasLeaveTypeNone: false,
      leaveTypeRaw: "Phép năm",
      hasOvertime: false,
      hasShortHours: false,
    });

    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "07:30",
        gioRa: "18:00",
        caLamViec: "Ca ngày",
        loaiPhep: "",
      }),
    ).toEqual({
      hasWorkHours: true,
      hasLeaveType: false,
      hasLeaveTypeNone: true,
      leaveTypeRaw: "",
      hasOvertime: true,
      hasShortHours: false,
    });

    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "08:30",
        gioRa: "16:00",
        caLamViec: "Ca ngày",
        loaiPhep: "1/2PN",
      }),
    ).toEqual({
      hasWorkHours: true,
      hasLeaveType: true,
      hasLeaveTypeNone: false,
      leaveTypeRaw: "1/2 Phép năm",
      hasOvertime: false,
      hasShortHours: false,
    });
  });

  it("reuses monthly presence matcher", () => {
    expect(
      matchesPayrollMonthTimesheetPresenceFilter(
        { hasWorkHours: false, hasLeaveType: true, hasOvertime: false },
        { leaveTypeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH },
      ),
    ).toBe(true);

    expect(
      matchesPayrollMonthTimesheetPresenceFilter(
        { hasWorkHours: true, hasLeaveType: false, hasOvertime: true },
        { overtimeFilter: PAYROLL_TIMESHEET_PRESENCE_FILTER.WITH },
      ),
    ).toBe(true);

    expect(
      matchesPayrollMonthTimesheetPresenceFilter(
        { hasWorkHours: true, hasLeaveType: false, hasShortHours: true },
        { shortHoursFilter: PAYROLL_SHORT_HOURS_FILTER.UNDER_STANDARD },
      ),
    ).toBe(true);
  });
});
