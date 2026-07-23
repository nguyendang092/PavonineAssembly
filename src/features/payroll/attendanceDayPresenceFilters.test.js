import { describe, expect, it } from "vitest";
import {
  getAttendanceDayEmployeePresenceFlags,
  matchesPayrollMonthTimesheetPresenceFilter,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
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
    ).toEqual({ hasWorkHours: true, hasLeaveType: false, hasOvertime: false });

    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "",
        gioRa: "",
        caLamViec: "Ca ngày",
        loaiPhep: "Phép năm",
      }),
    ).toEqual({ hasWorkHours: false, hasLeaveType: true, hasOvertime: false });

    expect(
      getAttendanceDayEmployeePresenceFlags({
        gioVao: "07:30",
        gioRa: "18:00",
        caLamViec: "Ca ngày",
        loaiPhep: "",
      }),
    ).toEqual({ hasWorkHours: true, hasLeaveType: false, hasOvertime: true });
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
  });
});
