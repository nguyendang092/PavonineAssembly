import { describe, expect, it } from "vitest";
import {
  attendanceRowCheckHighlightClassName,
  employeeHasPayrollOvertimeHours,
  isLeaveTypeCheckFieldDisabled,
  isLeaveTypeCheckPurpleHighlight,
  isOtCheckFieldDisabled,
  preserveAttendanceDayMetaInDayPayload,
  buildAttendanceExcelUploadFirebaseUpdates,
  buildAttendanceDeleteAllEmployeesFirebaseUpdates,
} from "./attendanceDayMeta";

describe("attendanceRowCheckHighlightClassName", () => {
  it("both checks on → yellow", () => {
    expect(
      attendanceRowCheckHighlightClassName({
        otCheck: true,
        leaveTypeCheck: true,
        leaveType: "1/2PN",
        hasOvertimeHours: true,
      }),
    ).toBe("att-row-check-ot");
  });

  it("only OT check → yellow", () => {
    expect(
      attendanceRowCheckHighlightClassName({
        otCheck: true,
        leaveTypeCheck: false,
      }),
    ).toBe("att-row-check-ot");
  });

  it("1/2PN + leave check + OT hours → purple", () => {
    expect(
      attendanceRowCheckHighlightClassName({
        otCheck: false,
        leaveTypeCheck: true,
        leaveType: "1/2PN",
        hasOvertimeHours: true,
      }),
    ).toBe("att-row-check-leave");
  });

  it("1/2PN + leave check without OT hours → yellow", () => {
    expect(
      attendanceRowCheckHighlightClassName({
        otCheck: false,
        leaveTypeCheck: true,
        leaveType: "1/2PN",
        hasOvertimeHours: false,
      }),
    ).toBe("att-row-check-ot");
  });

  it("PN + leave check → yellow", () => {
    expect(
      attendanceRowCheckHighlightClassName({
        otCheck: false,
        leaveTypeCheck: true,
        leaveType: "PN",
        hasOvertimeHours: true,
      }),
    ).toBe("att-row-check-ot");
  });
});

describe("isLeaveTypeCheckFieldDisabled", () => {
  it("disables when OT check on without leave type", () => {
    expect(
      isLeaveTypeCheckFieldDisabled({
        otCheck: true,
        leaveType: "",
      }),
    ).toBe(true);
  });

  it("allows when OT check on with leave type", () => {
    expect(
      isLeaveTypeCheckFieldDisabled({
        otCheck: true,
        leaveType: "PN",
      }),
    ).toBe(false);
  });
});

describe("isOtCheckFieldDisabled", () => {
  it("disables when 1/2PN without overtime hours", () => {
    expect(
      isOtCheckFieldDisabled({
        leaveType: "1/2PN",
        hasOvertimeHours: false,
      }),
    ).toBe(true);
  });

  it("allows when 1/2PN with overtime hours", () => {
    expect(
      isOtCheckFieldDisabled({
        leaveType: "1/2PN",
        hasOvertimeHours: true,
      }),
    ).toBe(false);
  });

  it("allows when not 1/2PN without overtime hours", () => {
    expect(
      isOtCheckFieldDisabled({
        leaveType: "PN",
        hasOvertimeHours: false,
      }),
    ).toBe(false);
  });
});

describe("employeeHasPayrollOvertimeHours", () => {
  it("detects lunch OT hours", () => {
    expect(
      employeeHasPayrollOvertimeHours({
        gioVao: "07:30",
        gioRa: "16:00",
        caLamViec: "S1",
        tangCaTrua: "1",
      }),
    ).toBe(true);
  });

  it("returns false for regular day without OT", () => {
    expect(
      employeeHasPayrollOvertimeHours({
        gioVao: "07:30",
        gioRa: "16:00",
        caLamViec: "S1",
        loaiPhep: "1/2PN",
      }),
    ).toBe(false);
  });
});

describe("isLeaveTypeCheckPurpleHighlight", () => {
  it("is false when OT check is on", () => {
    expect(
      isLeaveTypeCheckPurpleHighlight({
        otCheck: true,
        leaveTypeCheck: true,
        leaveType: "1/2PN",
        hasOvertimeHours: true,
      }),
    ).toBe(false);
  });
});

describe("attendance day _meta preservation", () => {
  it("preserveAttendanceDayMetaInDayPayload keeps off/lễ/NB flags", () => {
    const existing = {
      _meta: {
        isOffDay: true,
        isHolidayDay: false,
        isCompensatoryDay: false,
        earlyOtPaperwork: { emp_1: true },
      },
      emp_1: { mnv: "1" },
    };

    expect(
      preserveAttendanceDayMetaInDayPayload(existing, { emp_2: { mnv: "2" } }),
    ).toEqual({
      emp_2: { mnv: "2" },
      _meta: existing._meta,
    });

    const uploadUpdates = buildAttendanceExcelUploadFirebaseUpdates(
      "attendance",
      "2026-06-01",
      existing,
      { emp_1: { mnv: "1", gioVao: "08:00" }, emp_2: { mnv: "2" } },
    );
    expect(uploadUpdates).toEqual({
      "attendance/2026-06-01/emp_1": { mnv: "1", gioVao: "08:00" },
      "attendance/2026-06-01/emp_2": { mnv: "2" },
    });
    expect(uploadUpdates["attendance/2026-06-01/_meta"]).toBeUndefined();

    const deleteUpdates = buildAttendanceDeleteAllEmployeesFirebaseUpdates(
      "attendance",
      "2026-06-01",
      existing,
    );
    expect(deleteUpdates).toEqual({
      "attendance/2026-06-01/emp_1": null,
    });
    expect(deleteUpdates["attendance/2026-06-01/_meta"]).toBeUndefined();
  });
});
