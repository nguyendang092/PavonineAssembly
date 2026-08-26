import { describe, expect, it } from "vitest";
import {
  buildDerivedMapsFromLeaveAggYear,
  computeLeaveAggDeltasForDayChange,
  monthKeyFromDateKey,
} from "./attendanceLeaveAgg";
import { ATTENDANCE_LEAVE_AGG_EMP } from "./attendanceLeaveAggFields";

describe("attendanceLeaveAgg", () => {
  it("monthKeyFromDateKey returns mm from yyyy-mm-dd", () => {
    expect(monthKeyFromDateKey("2026-06-15")).toBe("06");
    expect(monthKeyFromDateKey("bad")).toBeNull();
  });

  it("buildDerivedMapsFromLeaveAggYear maps monthly totals and counted year sum", () => {
    const yearAggData = {
      emp_A: {
        [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: {
          "05": 1,
          "06": 2,
          "07": 0.5,
        },
      },
    };

    const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
      buildDerivedMapsFromLeaveAggYear(yearAggData, 2026);

    expect(attendanceMonthlyByEmpKey.emp_A).toEqual([
      0, 0, 0, 0, 1, 2, 0.5, 0, 0, 0, 0, 0,
    ]);
    expect(deductionsByEmpKey.emp_A).toBe(2.5);
  });

  it("computeLeaveAggDeltasForDayChange diffs one day snapshots", () => {
    const deltas = computeLeaveAggDeltasForDayChange(
      "2026-06-10",
      2026,
      { emp_A: { mnv: "A", loaiPhep: "Phép năm" } },
      { emp_A: { mnv: "A", loaiPhep: "1/2 Phép năm" } },
    );

    expect(deltas).toEqual([{ empKey: "emp_A", delta: -0.5 }]);
  });
});
