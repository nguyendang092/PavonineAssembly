import { describe, expect, it } from "vitest";
import {
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTHLY_TIMESHEET_STICKY_COL_COUNT,
  payrollMonthlyTimesheetLayoutOffsets,
  payrollMonthlyTimesheetTotalColCount,
} from "./payrollMonthlyTimesheetLayout";

describe("payrollMonthlyTimesheetLayout", () => {
  it("matches grid column count (4 sticky + days + 3×16 detail)", () => {
    const days = 31;
    expect(payrollMonthlyTimesheetTotalColCount(days)).toBe(
      MONTHLY_TIMESHEET_STICKY_COL_COUNT + days + 3 * MONTH_DETAIL_COLS_PER_BLOCK,
    );
    const o = payrollMonthlyTimesheetLayoutOffsets(days);
    expect(o.totalDetailStart).toBe(MONTHLY_TIMESHEET_STICKY_COL_COUNT + days);
    expect(o.trialDetailStart).toBe(o.totalDetailStart + MONTH_DETAIL_COLS_PER_BLOCK);
    expect(o.officialDetailStart).toBe(o.trialDetailStart + MONTH_DETAIL_COLS_PER_BLOCK);
  });
});
