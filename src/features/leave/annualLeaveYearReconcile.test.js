import { describe, expect, it, vi, beforeEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { persistAnnualLeaveYearFromAttendance } from "./annualLeaveAttendanceSync";
import * as payrollAccrual from "./annualLeavePayrollAccrual";
import { createAnnualLeaveRunTransactionMock } from "./__testHelpers__/annualLeaveTransactionMock";
import { createAnnualLeaveBatchUpdateMock } from "./__testHelpers__/annualLeaveBatchUpdateMock";

vi.mock("./annualLeaveMonthWorkSummaryPersistCache", () => ({
  getCachedAnnualLeaveMonthWorkSummaryByEmpKey: vi.fn(() => ({})),
  invalidateAnnualLeaveMonthWorkSummaryPersistCache: vi.fn(),
}));

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockRunTransaction = vi.fn();
/** @type {Record<string, unknown> | null} */
let leaveAggStore = null;
/** @type {Record<string, Record<string, unknown>>} */
let annualLeaveStore = {};

vi.mock("@/services/firebase", () => ({
  get: (...args) => mockGet(...args),
  update: (...args) => mockUpdate(...args),
  set: (...args) => mockSet(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  ref: (_db, path) => path,
  query: (refPath) => refPath,
  orderByKey: () => ({}),
  startAt: () => ({}),
  endAt: () => ({}),
}));

describe("persistAnnualLeaveYearFromAttendance", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockSet.mockReset();
    mockRunTransaction.mockReset();
    annualLeaveStore = {};
    leaveAggStore = null;
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockUpdate.mockImplementation(
      createAnnualLeaveBatchUpdateMock(annualLeaveStore),
    );
    mockSet.mockImplementation((path, data) => {
      if (path === "attendanceLeaveAgg/2026") {
        leaveAggStore = data;
      }
      return Promise.resolve();
    });
    vi.useRealTimers();
  });

  it("syncs PN across multiple days at emp_{mnv} keys", async () => {
    vi.spyOn(
      payrollAccrual,
      "buildAnnualLeaveMonthWorkSummaryByEmpKey",
    ).mockReturnValue({});

    annualLeaveStore = {
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
    };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockUpdate.mockImplementation(
      createAnnualLeaveBatchUpdateMock(annualLeaveStore),
    );

    mockGet.mockImplementation((path) => {
      if (path === "attendanceLeaveAgg/2026") {
        return Promise.resolve({ val: () => leaveAggStore });
      }
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
          val: () => annualLeaveStore,
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
      undefined,
      expect.objectContaining({
        "annualLeave/2026/emp_240324": expect.objectContaining({
          id: "emp_240324",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        }),
        "annualLeave/2026/emp_ABC": expect.objectContaining({
          id: "emp_ABC",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        }),
      }),
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(annualLeaveStore.emp_240324).toEqual(
      expect.objectContaining({
        id: "emp_240324",
        [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 0,
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.BALANCE]: 4,
      }),
    );
    expect(annualLeaveStore.emp_ABC).toEqual(
      expect.objectContaining({
        id: "emp_ABC",
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.BALANCE]: 9,
      }),
    );

    vi.restoreAllMocks();
  });

  it("recalculates annualLeaveCurrentYear for all employees with start date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14));

    annualLeaveStore = {
      emp_251205: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-10",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 99,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
      },
      emp_260638: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "260638",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "18-Jun-2026",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 2,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
      },
    };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockUpdate.mockImplementation(
      createAnnualLeaveBatchUpdateMock(annualLeaveStore),
    );

    mockGet.mockImplementation((path) => {
      if (path === "attendanceLeaveAgg/2026") {
        return Promise.resolve({ val: () => leaveAggStore });
      }
      if (path === "attendance") {
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

    const { appliedCount } = await persistAnnualLeaveYearFromAttendance(
      {},
      { year: 2026, attendanceRootPath: "attendance" },
    );

    expect(appliedCount).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        "annualLeave/2026/emp_251205": expect.objectContaining({
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 7,
        }),
        "annualLeave/2026/emp_260638": expect.objectContaining({
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 0,
        }),
      }),
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(annualLeaveStore.emp_251205).toEqual(
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 7,
      }),
    );
    expect(annualLeaveStore.emp_260638).toEqual(
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2026-06-18",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 0,
      }),
    );
  });
});
