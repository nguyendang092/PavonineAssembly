import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_META_MIGRATED,
} from "./annualLeaveFields";
import { migrateAnnualLeaveYearToEmpKeys } from "./annualLeaveAttendanceSync";

const mockUpdate = vi.fn();

vi.mock("@/services/firebase", () => ({
  update: (...args) => mockUpdate(...args),
  ref: (_db, path) => path,
}));

describe("migrateAnnualLeaveYearToEmpKeys", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("skips scan when _meta.migrated is true", async () => {
    const result = await migrateAnnualLeaveYearToEmpKeys({}, 2026, {
      [ANNUAL_LEAVE_META_KEY]: { [ANNUAL_LEAVE_META_MIGRATED]: true },
      legacy_1: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "1",
      },
    });

    expect(result).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets migrated flag when no legacy keys remain", async () => {
    const result = await migrateAnnualLeaveYearToEmpKeys({}, 2026, {
      [ANNUAL_LEAVE_META_KEY]: { rowCount: 1 },
      emp_PAVO1: {
        id: "emp_PAVO1",
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "PAVO1",
      },
    });

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith("annualLeave/2026/_meta", {
      [ANNUAL_LEAVE_META_MIGRATED]: true,
    });
  });

  it("migrates legacy keys and sets migrated in one batch", async () => {
    const result = await migrateAnnualLeaveYearToEmpKeys({}, 2026, {
      [ANNUAL_LEAVE_META_KEY]: { rowCount: 1 },
      "240324": {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "240324",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
      },
    });

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(undefined, {
      "annualLeave/2026/emp_240324": {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "240324",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
        id: "emp_240324",
      },
      "annualLeave/2026/240324": null,
      "annualLeave/2026/_meta": {
        rowCount: 1,
        [ANNUAL_LEAVE_META_MIGRATED]: true,
      },
    });
  });
});
