import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import {
  buildAttendanceAnnualLeaveDeductionsByMnv,
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
  buildAttendanceAnnualLeaveUsageDetailForEmpKey,
  createEmptyAnnualLeaveUsageDetail,
  attendanceMnvKeyFromDayRecord,
  getAnnualLeaveBalanceForEmployee,
  getDisplayAnnualLeaveBalanceForAttendance,
  annualLeaveYearFromDateKey,
  attendanceAnnualLeaveDeductionForLoaiPhep,
  annualLeaveFirebaseKeyForMnv,
} from "./annualLeaveBalanceLookup";

describe("annualLeaveBalanceLookup", () => {
  it("maps emp_{mnv} to balance via live builder", () => {
    const yearData = {
      emp_PAVO: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
        [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 3,
      },
    };
    const map = buildLiveAnnualLeaveBalanceByMnv(yearData, {});
    expect(map.emp_PAVO).toBe(9);
    expect(getAnnualLeaveBalanceForEmployee({ mnv: "PAVO" }, map)).toBe(9);
  });

  it("matches attendance MNV to emp_{mnv}", () => {
    const map = buildLiveAnnualLeaveBalanceByMnv(
      {
        emp_12: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "12",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
        },
      },
      {},
    );
    expect(annualLeaveFirebaseKeyForMnv("12")).toBe("emp_12");
    expect(getAnnualLeaveBalanceForEmployee({ mnv: "12" }, map)).toBe(8);
  });

  it("display uses live balance map", () => {
    const map = buildLiveAnnualLeaveBalanceByMnv(
      {
        emp_ABC: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "ABC",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
        },
      },
      { emp_ABC: 5 },
    );
    const emp = { mnv: "ABC", loaiPhep: "Phép năm" };
    expect(getDisplayAnnualLeaveBalanceForAttendance(emp, map)).toBe(3);
  });

  it("sums PN across attendance days in year by emp key", () => {
    const totals = buildAttendanceAnnualLeaveDeductionsByMnv(
      {
        "2026-06-01": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
        "2026-06-10": { emp_X: { mnv: "X", loaiPhep: "PN" } },
        "2026-07-01": { emp_X: { mnv: "X", loaiPhep: "1/2PN" } },
        "2025-12-31": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      },
      2026,
    );
    expect(totals.emp_X).toBe(2.5);
  });

  it("sums PN only within year-month when prefix provided", () => {
    const data = {
      "2026-06-01": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-06-15": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-07-01": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
    };
    expect(buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, "2026-06").emp_X).toBe(
      2,
    );
    expect(buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, "2026-07").emp_X).toBe(
      1,
    );
  });

  it("ignores trial attendance before 2026-06-01", () => {
    const data = {
      "2026-05-15": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-05-30": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-06-01": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-06-10": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
    };
    expect(buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026).emp_X).toBe(2);
    expect(
      buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, "2026-05").emp_X ?? 0,
    ).toBe(0);
    expect(buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, "2026-06").emp_X).toBe(
      2,
    );
  });

  it("counts PN through selected date (cumulative)", () => {
    const data = {
      "2026-06-03": { emp_251205: { loaiPhep: "Phép năm" } },
      "2026-06-10": { emp_251205: { loaiPhep: "Phép năm" } },
      "2026-06-20": { emp_251205: { loaiPhep: "Phép năm" } },
      "2026-07-05": { emp_251205: { loaiPhep: "Phép năm" } },
    };
    expect(
      buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, {
        throughDateKey: "2026-06-15",
      }).emp_251205,
    ).toBe(2);
    expect(
      buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026, {
        throughDateKey: "2026-07-31",
      }).emp_251205,
    ).toBe(4);
  });

  it("reads MNV from emp_{code} key when mnv field empty", () => {
    expect(attendanceMnvKeyFromDayRecord("emp_251205", {})).toBe("251205");
    const data = {
      "2026-06-01": {
        emp_251205: { phepNam: "PN" },
        emp_251205_dup: { mnv: "251205", loaiPhep: "Phép năm" },
      },
    };
    expect(buildAttendanceAnnualLeaveDeductionsByMnv(data, 2026).emp_251205).toBe(2);
  });

  it("parses year from date key", () => {
    expect(annualLeaveYearFromDateKey("2026-06-03")).toBe(2026);
  });

  it("deducts PN and 1/2PN amounts", () => {
    expect(attendanceAnnualLeaveDeductionForLoaiPhep("PN")).toBe(1);
    expect(attendanceAnnualLeaveDeductionForLoaiPhep("1/2PN")).toBe(0.5);
    expect(attendanceAnnualLeaveDeductionForLoaiPhep("Phép ốm")).toBe(0);
  });

  it("builds monthly PN usage detail by emp key", () => {
    const data = {
      "2026-06-03": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-06-10": { emp_X: { mnv: "X", loaiPhep: "1/2PN" } },
      "2026-07-05": { emp_X: { mnv: "X", loaiPhep: "PN" } },
      "2026-05-20": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
    };
    const detail = buildAttendanceAnnualLeaveUsageDetailByEmpKey(data, 2026, {
      throughDateKey: "2026-07-31",
    });
    const emp = detail.emp_X;
    expect(emp.totalPn).toBe(2);
    expect(emp.totalHalfPn).toBe(1);
    expect(emp.totalDeduction).toBe(2.5);
    expect(emp.months.map((m) => m.yearMonth)).toEqual([
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
    expect(emp.months[0].pnCount).toBe(1);
    expect(emp.months[1].pnCount).toBe(1);
    expect(emp.months[1].halfPnCount).toBe(1);
    expect(emp.months[1].days.map((d) => d.dateKey)).toEqual([
      "2026-06-03",
      "2026-06-10",
    ]);
  });

  it("fills all counted months through throughDateKey", () => {
    const data = {
      "2026-06-03": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
      "2026-07-05": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
    };
    const detail = buildAttendanceAnnualLeaveUsageDetailByEmpKey(data, 2026, {
      throughDateKey: "2026-08-15",
    }).emp_X;
    expect(detail.months.map((m) => m.yearMonth)).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
    expect(detail.months[0].pnCount).toBe(0);
    expect(detail.months[0].days).toEqual([]);
    expect(detail.months[1].pnCount).toBe(1);
    expect(detail.months[2].pnCount).toBe(1);
  });

  it("shows pre-count trial months for display only without affecting totals", () => {
    const data = {
      "2026-05-20": { emp_X: { mnv: "X", loaiPhep: "Phép năm" } },
    };
    const emp = buildAttendanceAnnualLeaveUsageDetailByEmpKey(data, 2026, {
      throughDateKey: "2026-08-15",
    }).emp_X;
    expect(emp.totalPn).toBe(0);
    expect(emp.totalDeduction).toBe(0);
    expect(emp.months).toHaveLength(4);
    expect(emp.months[3].yearMonth).toBe("2026-05");
    expect(emp.months[3].displayOnly).toBe(true);
    expect(emp.months[3].pnCount).toBe(1);
    expect(emp.months[3].totalDeduction).toBe(0);
  });

  it("createEmptyAnnualLeaveUsageDetail returns array months for modal", () => {
    const detail = createEmptyAnnualLeaveUsageDetail(2026, {
      throughDateKey: "2026-08-15",
    });
    expect(Array.isArray(detail.months)).toBe(true);
    expect(detail.months.length).toBeGreaterThan(0);
    expect(detail.totalDeduction).toBe(0);
  });

  it("buildAttendanceAnnualLeaveUsageDetailForEmpKey returns empty layout when no PN", () => {
    const detail = buildAttendanceAnnualLeaveUsageDetailForEmpKey(
      {},
      2026,
      "emp_X",
      { throughDateKey: "2026-08-15" },
    );
    expect(detail).not.toBeNull();
    expect(Array.isArray(detail.months)).toBe(true);
    expect(detail.totalPn).toBe(0);
  });
});
