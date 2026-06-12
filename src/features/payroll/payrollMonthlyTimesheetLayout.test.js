import { describe, expect, it } from "vitest";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTH_DETAIL_OT_COL_COUNT,
  MONTH_DETAIL_SATS_COL_COUNT,
  MONTH_DETAIL_WORKDAY_COL_COUNT,
  MONTHLY_TIMESHEET_STICKY_COL_COUNT,
  payrollMonthlyTimesheetLayoutOffsets,
  payrollMonthlyTimesheetTotalColCount,
} from "./payrollMonthlyTimesheetLayout";

describe("payrollMonthlyTimesheetLayout", () => {
  it("matches grid column count (5 sticky + days + 3×17 detail)", () => {
    const days = 31;
    expect(payrollMonthlyTimesheetTotalColCount(days)).toBe(
      MONTHLY_TIMESHEET_STICKY_COL_COUNT + days + 3 * MONTH_DETAIL_COLS_PER_BLOCK,
    );
    const o = payrollMonthlyTimesheetLayoutOffsets(days);
    expect(o.totalDetailStart).toBe(MONTHLY_TIMESHEET_STICKY_COL_COUNT + days);
    expect(o.trialDetailStart).toBe(o.totalDetailStart + MONTH_DETAIL_COLS_PER_BLOCK);
    expect(o.officialDetailStart).toBe(o.trialDetailStart + MONTH_DETAIL_COLS_PER_BLOCK);
  });

  it("detail sub-groups sum to cols per block (workday + OT + SAT.S)", () => {
    expect(
      MONTH_DETAIL_WORKDAY_COL_COUNT +
        MONTH_DETAIL_OT_COL_COUNT +
        MONTH_DETAIL_SATS_COL_COUNT,
    ).toBe(MONTH_DETAIL_COLS_PER_BLOCK);
  });
});
