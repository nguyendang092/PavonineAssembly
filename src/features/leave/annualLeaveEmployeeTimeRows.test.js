import { describe, expect, it } from "vitest";
import { buildEmployeeAttendanceDayRow, buildEmployeeAttendanceTimeRows } from "./annualLeaveEmployeeTimeRows";

describe("buildEmployeeAttendanceTimeRows", () => {
  const attendanceRoot = {
    "2026-06-02": {
      emp_240324: {
        mnv: "240324",
        gioVao: "07:30",
        gioRa: "16:30",
        caLamViec: "S1",
      },
      emp_999999: {
        mnv: "999999",
        gioVao: "08:00",
      },
    },
    "2026-06-03": {
      emp_240324: {
        mnv: "240324",
        loaiPhep: "Phép năm",
      },
    },
    "2026-05-01": {
      emp_240324: {
        mnv: "240324",
        gioVao: "07:00",
      },
    },
  };

  it("returns time rows for one emp key sorted newest first", () => {
    const rows = buildEmployeeAttendanceTimeRows(
      attendanceRoot,
      2026,
      "emp_240324",
    );
    expect(rows.map((r) => r.dateKey)).toEqual([
      "2026-06-03",
      "2026-06-02",
      "2026-05-01",
    ]);
    expect(rows[0]).toMatchObject({
      dateKey: "2026-06-03",
      timeIn: "—",
      leaveType: "PN",
    });
    expect(rows[1]).toMatchObject({
      dateKey: "2026-06-02",
      timeIn: "07:30",
      timeOut: "16:30",
      shift: "S1",
    });
  });

  it("respects throughDateKey filter", () => {
    const rows = buildEmployeeAttendanceTimeRows(
      attendanceRoot,
      2026,
      "emp_240324",
      { throughDateKey: "2026-06-02" },
    );
    expect(rows.map((r) => r.dateKey)).toEqual(["2026-06-02", "2026-05-01"]);
  });

  it("respects yearMonthPrefix filter", () => {
    const rows = buildEmployeeAttendanceTimeRows(
      attendanceRoot,
      2026,
      "emp_240324",
      { yearMonthPrefix: "2026-06" },
    );
    expect(rows.map((r) => r.dateKey)).toEqual(["2026-06-03", "2026-06-02"]);
  });

  it("includes compensatory day as NB when no attendance signal", () => {
    const root = {
      ...attendanceRoot,
      "2026-06-04": {
        _meta: { isCompensatoryDay: true },
      },
    };
    const rows = buildEmployeeAttendanceTimeRows(root, 2026, "emp_240324", {
      yearMonthPrefix: "2026-06",
    });
    const nbRow = rows.find((r) => r.dateKey === "2026-06-04");
    expect(nbRow).toMatchObject({
      dateKey: "2026-06-04",
      timeIn: "—",
      timeOut: "—",
      leaveType: "NB",
      shift: "—",
    });
  });

  it("does not show NB on compensatory day when leave type is NV", () => {
    const root = {
      "2026-06-05": {
        _meta: { isCompensatoryDay: true },
        emp_240324: {
          mnv: "240324",
          loaiPhep: "Nghỉ việc",
        },
      },
    };
    const rows = buildEmployeeAttendanceTimeRows(root, 2026, "emp_240324");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dateKey: "2026-06-05",
      leaveType: "NV",
    });
  });

  it("does not show NB on compensatory day when leave type is TS", () => {
    const root = {
      "2026-06-06": {
        _meta: { isCompensatoryDay: true },
        emp_240324: {
          mnv: "240324",
          loaiPhep: "Thai sản",
        },
      },
    };
    const rows = buildEmployeeAttendanceTimeRows(root, 2026, "emp_240324");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dateKey: "2026-06-06",
      leaveType: "TS",
    });
  });
});

describe("buildEmployeeAttendanceDayRow", () => {
  it("returns attendance fields for one date", () => {
    const row = buildEmployeeAttendanceDayRow(
      {
        "2026-06-03": {
          emp_240324: {
            mnv: "240324",
            loaiPhep: "Phép năm",
          },
        },
      },
      "2026-06-03",
      "emp_240324",
    );
    expect(row).toMatchObject({
      dateKey: "2026-06-03",
      timeIn: "—",
      timeOut: "—",
      leaveType: "PN",
      hasRecord: true,
    });
  });

  it("returns empty row when day is missing", () => {
    const row = buildEmployeeAttendanceDayRow({}, "2026-06-02", "emp_240324");
    expect(row).toMatchObject({
      dateKey: "2026-06-02",
      hasRecord: false,
      timeIn: "—",
    });
  });
});
