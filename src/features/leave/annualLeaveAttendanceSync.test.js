import { describe, expect, it, vi, beforeEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { applyAnnualLeaveDeductionDelta } from "./annualLeaveAttendanceSync";

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/services/firebase", () => ({
  get: (...args) => mockGet(...args),
  update: (...args) => mockUpdate(...args),
  ref: (_db, path) => path,
}));

describe("applyAnnualLeaveDeductionDelta", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
  });

  function mockYearWithAttendance(attendanceData, yearRecords) {
    mockGet.mockImplementation((path) => {
      if (path === "attendance") {
        return Promise.resolve({ val: () => attendanceData });
      }
      if (path === "annualLeave/2026") {
        return Promise.resolve({ val: () => yearRecords });
      }
      if (path === "annualLeave/2026/_meta") {
        return Promise.resolve({ exists: () => true, val: () => ({}) });
      }
      return Promise.resolve({ exists: () => false, val: () => null });
    });
  }

  it("recomputes used from all PN days in the year (3 PN → used 3)", async () => {
    mockYearWithAttendance(
      {
        "2026-06-01": {
          emp_PAVO1: { mnv: "PAVO1", loaiPhep: "Phép năm" },
        },
        "2026-06-10": {
          emp_PAVO1: { mnv: "PAVO1", loaiPhep: "Phép năm" },
        },
        "2026-06-20": {
          emp_PAVO1: { mnv: "PAVO1", loaiPhep: "Phép năm" },
        },
      },
      {
        emp_PAVO1: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        },
      },
    );

    const result = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      oldLoaiPhep: "",
      newLoaiPhep: "Phép năm",
    });

    expect(result.applied).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/emp_PAVO1",
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 3,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
        [ANNUAL_LEAVE_EMP.BALANCE]: 1.5,
      }),
    );
  });

  it("matches attendance MNV to emp_{mnv} not combined code", async () => {
    mockYearWithAttendance(
      {
        "2026-06-01": {
          emp_12: { mnv: "12", loaiPhep: "Phép năm" },
        },
      },
      {
        emp_12: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "12",
          [ANNUAL_LEAVE_EMP.MNV_SUFFIX]: "345",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 1,
          [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 0,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        },
      },
    );

    const result = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      oldLoaiPhep: "",
      newLoaiPhep: "Phép năm",
    });

    expect(result.applied).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/emp_12",
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
        [ANNUAL_LEAVE_EMP.BALANCE]: 10,
      }),
    );
  });

  it("skips recompute when loai phép delta is zero", async () => {
    mockYearWithAttendance({}, { emp_PAVO1: {} });

    const noDelta = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      oldRecord: { phepNam: "PN" },
      newLoaiPhep: "Phép năm",
    });
    expect(noDelta.applied).toBe(false);
    expect(noDelta.reason).toBe("no_delta");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("recomputes to zero attendance used when PN rows are removed", async () => {
    mockYearWithAttendance(
      {},
      {
        emp_PAVO1: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
          [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
          [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
        },
      },
    );

    const result = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      oldLoaiPhep: "Phép năm",
      newLoaiPhep: "",
    });

    expect(result.applied).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/emp_PAVO1",
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 0,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
        [ANNUAL_LEAVE_EMP.BALANCE]: 10,
      }),
    );
  });
});
