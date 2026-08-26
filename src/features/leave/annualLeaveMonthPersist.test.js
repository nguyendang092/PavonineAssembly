import { describe, expect, it, vi, beforeEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { ATTENDANCE_LEAVE_AGG_EMP } from "./attendanceLeaveAggFields";
import { persistAnnualLeaveMonthFromAttendance } from "./annualLeaveAttendanceSync";
import { createAnnualLeaveRunTransactionMock } from "./__testHelpers__/annualLeaveTransactionMock";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();

/** @type {Record<string, Record<string, unknown>>} */
let annualLeaveStore = {};

vi.mock("@/services/firebase", () => ({
  get: (...args) => mockGet(...args),
  update: (...args) => mockUpdate(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  ref: (_db, path) => path,
  query: (refPath) => refPath,
  orderByKey: () => ({}),
  startAt: () => ({}),
  endAt: () => ({}),
}));

vi.mock("./annualLeavePayrollAccrual", () => ({
  buildAnnualLeaveMonthWorkSummaryByEmpKey: vi.fn(() => ({})),
  listAnnualLeaveAccrualYearMonths: vi.fn(() => []),
  resolveAccrualYearMonthsAttendanceRange: vi.fn(() => null),
}));

describe("persistAnnualLeaveMonthFromAttendance", () => {
  beforeEach(() => {
    annualLeaveStore = {};
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockRunTransaction.mockReset();
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
  });

  it("reads month attendance query and agg — not full-year attendance root", async () => {
    annualLeaveStore.emp_A = {
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "A",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
    };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockGet.mockImplementation((path) => {
      if (path === "attendanceLeaveAgg/2026") {
        return Promise.resolve({
          val: () => ({
            emp_A: {
              [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: { "06": 1 },
            },
          }),
        });
      }
      if (typeof path === "string" && path.startsWith("attendance") && path !== "attendance") {
        return Promise.resolve({ val: () => ({}) });
      }
      if (path === "annualLeave/2026") {
        return Promise.resolve({
          val: () => annualLeaveStore,
        });
      }
      if (path === "annualLeave/2026/_meta") {
        return Promise.resolve({ exists: () => true, val: () => ({}) });
      }
      return Promise.resolve({ exists: () => false, val: () => null });
    });

    const { appliedCount } = await persistAnnualLeaveMonthFromAttendance({}, {
      year: 2026,
      yearMonth: "2026-06",
      scopeEmpKeySet: new Set(["emp_A"]),
    });

    expect(appliedCount).toBe(1);
    const getPaths = mockGet.mock.calls.map(([path]) => path);
    expect(getPaths).toContain("attendanceLeaveAgg/2026");
    expect(getPaths).toContain("annualLeave/2026");
    expect(getPaths.filter((path) => path === "attendance").length).toBe(1);
    expect(annualLeaveStore.emp_A).toEqual(
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
      }),
    );
    expect(mockRunTransaction).toHaveBeenCalledWith(
      "annualLeave/2026/emp_A",
      expect.any(Function),
    );
  });
});
