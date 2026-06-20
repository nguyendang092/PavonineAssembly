import { describe, expect, it, vi, beforeEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/services/firebase", () => ({
  get: (...args) => mockGet(...args),
  update: (...args) => mockUpdate(...args),
  ref: (_db, path) => path,
}));

describe("persistAnnualLeaveYearFromAttendance", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
  });

  it("syncs PN across multiple days at emp_{mnv} keys", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "attendance") {
        return Promise.resolve({
          val: () => ({
            "2026-06-01": {
              emp_240324: {
                mnv: "240324",
                loaiPhep: "Phép năm",
                id: "emp_240324",
              },
            },
            "2026-06-15": {
              emp_ABC: { mnv: "ABC", loaiPhep: "Phép năm", id: "emp_ABC" },
            },
            "2025-06-01": {
              emp_OLD: { mnv: "OLD", loaiPhep: "Phép năm" },
            },
          }),
        });
      }
      if (path === "annualLeave/2026") {
        return Promise.resolve({
          val: () => ({
            emp_240324: {
              [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "240324",
              [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 5,
              [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2.5,
            },
            emp_ABC: {
              [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "ABC",
              [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
              [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
            },
          }),
        });
      }
      if (path === "annualLeave/2026/_meta") {
        return Promise.resolve({ exists: () => true, val: () => ({}) });
      }
      return Promise.resolve({ exists: () => false, val: () => null });
    });

    const { appliedCount } = await persistAnnualLeaveYearFromAttendance(
      {},
      { year: 2026, attendanceRootPath: "attendance" },
    );

    expect(appliedCount).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/emp_240324",
      expect.objectContaining({
        id: "emp_240324",
        [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 0,
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.BALANCE]: 4,
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/emp_ABC",
      expect.objectContaining({
        id: "emp_ABC",
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.BALANCE]: 9,
      }),
    );
  });
});
