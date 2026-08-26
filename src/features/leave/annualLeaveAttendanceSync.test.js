import { describe, expect, it, vi, beforeEach } from "vitest";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { ATTENDANCE_LEAVE_AGG_EMP } from "./attendanceLeaveAggFields";
import {
  applyAnnualLeaveDeductionDelta,
  persistAnnualLeaveEmployeeAdjustment,
  persistAnnualLeaveYearFromAttendance,
} from "./annualLeaveAttendanceSync";
import { createAnnualLeaveRunTransactionMock } from "./__testHelpers__/annualLeaveTransactionMock";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockRunTransaction = vi.fn();

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

vi.mock("./annualLeavePayrollAccrual", () => ({
  buildAnnualLeaveMonthWorkSummaryByEmpKey: vi.fn(() => ({})),
  listAnnualLeaveAccrualYearMonths: vi.fn(() => []),
  resolveAccrualYearMonthsAttendanceRange: vi.fn(() => null),
}));

vi.mock("./annualLeavePersistQueue", () => ({
  queueSingleEmployeeAnnualLeavePersist: vi.fn(() => Promise.resolve()),
}));

vi.mock("./annualLeaveMonthWorkSummaryPersistCache", () => ({
  getCachedAnnualLeaveMonthWorkSummaryByEmpKey: vi.fn(() => ({})),
  invalidateAnnualLeaveMonthWorkSummaryPersistCache: vi.fn(),
}));

describe("applyAnnualLeaveDeductionDelta", () => {
  beforeEach(() => {
    annualLeaveStore = {};
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockSet.mockReset();
    mockRunTransaction.mockReset();
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
  });

  function mockYearWithLeaveAgg(yearRecords, leaveAggData = null) {
    annualLeaveStore = { ...yearRecords };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockGet.mockImplementation((path) => {
      if (path === "attendanceLeaveAgg/2026") {
        return Promise.resolve({ val: () => leaveAggData });
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

  it("persistAnnualLeaveYearFromAttendance reads aggregate (3 PN in June → used 3)", async () => {
    mockYearWithLeaveAgg(
      {
        emp_PAVO1: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 4.5,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        },
      },
      {
        emp_PAVO1: {
          [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: { "06": 3 },
        },
      },
    );

    const { appliedCount } = await persistAnnualLeaveYearFromAttendance({}, {
      year: 2026,
    });

    expect(appliedCount).toBe(1);
    expect(mockGet).not.toHaveBeenCalledWith("attendance");
    expect(annualLeaveStore.emp_PAVO1).toEqual(
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 3,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
        [ANNUAL_LEAVE_EMP.BALANCE]: 1.5,
      }),
    );
    expect(mockRunTransaction).toHaveBeenCalledWith(
      "annualLeave/2026/emp_PAVO1",
      expect.any(Function),
    );
  });

  it("updates leave aggregate via transaction when empKey and dateKey are known", async () => {
    mockYearWithLeaveAgg({ emp_PAVO1: {} }, {});

    const result = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      dateKey: "2026-06-01",
      oldRecord: { id: "emp_PAVO1", mnv: "PAVO1", loaiPhep: "" },
      newLoaiPhep: "Phép năm",
      updatedBy: "hr@test.com",
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe("queued");
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it("skips recompute when loai phép delta is zero", async () => {
    mockYearWithLeaveAgg({}, {});

    const noDelta = await applyAnnualLeaveDeductionDelta({}, {
      year: 2026,
      dateKey: "2026-06-01",
      oldRecord: { id: "emp_PAVO1", phepNam: "PN" },
      newLoaiPhep: "Phép năm",
    });
    expect(noDelta.applied).toBe(false);
    expect(noDelta.reason).toBe("no_delta");
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

describe("persistAnnualLeaveEmployeeAdjustment", () => {
  beforeEach(() => {
    annualLeaveStore = {};
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockRunTransaction.mockReset();
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    mockGet.mockImplementation((path) => {
      if (path === "annualLeave/2026/_meta") {
        return Promise.resolve({ exists: () => true, val: () => ({}) });
      }
      return Promise.resolve({ exists: () => false, val: () => null });
    });
  });

  it("writes adjustment and full annual leave totals to Firebase", async () => {
    annualLeaveStore.emp_PAVO1 = {
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
      [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
      [ANNUAL_LEAVE_EMP.BALANCE]: 9,
    };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    const raw = annualLeaveStore.emp_PAVO1;

    const result = await persistAnnualLeaveEmployeeAdjustment({}, {
      year: 2026,
      empKey: "emp_PAVO1",
      raw,
      adjustment: 1,
      deductionsByEmpKey: { emp_PAVO1: 1 },
      updatedBy: "hr@test.com",
    });

    expect(result.applied).toBe(true);
    expect(annualLeaveStore.emp_PAVO1).toEqual(
      expect.objectContaining({
        id: "emp_PAVO1",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 1,
        [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: 2,
        [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
        [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 13,
        [ANNUAL_LEAVE_EMP.BALANCE]: 10,
      }),
    );
    expect(mockRunTransaction).toHaveBeenCalledWith(
      "annualLeave/2026/emp_PAVO1",
      expect.any(Function),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      "annualLeave/2026/_meta",
      expect.objectContaining({
        updatedAt: expect.any(String),
        updatedBy: "hr@test.com",
      }),
    );
  });

  it("clears adjustment field when value is zero", async () => {
    annualLeaveStore.emp_PAVO1 = {
      [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 1,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
    };
    mockRunTransaction.mockImplementation(
      createAnnualLeaveRunTransactionMock(annualLeaveStore),
    );
    const raw = annualLeaveStore.emp_PAVO1;

    await persistAnnualLeaveEmployeeAdjustment({}, {
      year: 2026,
      empKey: "emp_PAVO1",
      raw,
      adjustment: 0,
    });

    expect(annualLeaveStore.emp_PAVO1).toEqual(
      expect.objectContaining({
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: null,
      }),
    );
  });
});
