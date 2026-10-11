import { describe, expect, it } from "vitest";
import {
  MONTH_DETAIL_ANNUAL_LEAVE_COL_COUNT,
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTH_DETAIL_OT_COL_COUNT,
  MONTH_DETAIL_PHASE_COLS_PER_BLOCK,
  MONTH_DETAIL_PHASE_WORKDAY_COL_COUNT,
  MONTH_DETAIL_SATS_COL_COUNT,
  MONTH_DETAIL_TOTAL_COLS_PER_BLOCK,
  MONTH_DETAIL_WORKDAY_COL_COUNT,
  MONTHLY_TIMESHEET_STICKY_COL_COUNT,
  monthlyDetailFlatColCount,
  monthlyDetailTotalColsPerBlock,
  payrollMonthlyTimesheetLayoutOffsets,
  payrollMonthlyTimesheetTotalColCount,
} from "./payrollMonthlyTimesheetLayout";

describe("payrollMonthlyTimesheetLayout", () => {
  it("matches grid column count (6 sticky + days + detail blocks)", () => {
    const days = 31;
    expect(payrollMonthlyTimesheetTotalColCount(days)).toBe(
      MONTHLY_TIMESHEET_STICKY_COL_COUNT + days + monthlyDetailFlatColCount(),
    );
    const o = payrollMonthlyTimesheetLayoutOffsets(days);
    expect(o.totalDetailStart).toBe(MONTHLY_TIMESHEET_STICKY_COL_COUNT + days);
    expect(o.trialDetailStart).toBe(
      o.totalDetailStart + MONTH_DETAIL_TOTAL_COLS_PER_BLOCK,
    );
    expect(o.officialDetailStart).toBe(
      o.trialDetailStart + MONTH_DETAIL_PHASE_COLS_PER_BLOCK,
    );
  });

  it("detail sub-groups sum to cols per block (total vs phase)", () => {
    expect(
      MONTH_DETAIL_WORKDAY_COL_COUNT +
        MONTH_DETAIL_OT_COL_COUNT +
        MONTH_DETAIL_SATS_COL_COUNT,
    ).toBe(MONTH_DETAIL_TOTAL_COLS_PER_BLOCK);
    expect(
      MONTH_DETAIL_PHASE_WORKDAY_COL_COUNT +
        MONTH_DETAIL_OT_COL_COUNT +
        MONTH_DETAIL_SATS_COL_COUNT,
    ).toBe(MONTH_DETAIL_PHASE_COLS_PER_BLOCK);
    expect(MONTH_DETAIL_COLS_PER_BLOCK).toBe(MONTH_DETAIL_TOTAL_COLS_PER_BLOCK);
  });

  it("adds two annual-leave columns only on the total block when enabled", () => {
    const days = 31;
    expect(monthlyDetailTotalColsPerBlock(true)).toBe(
      MONTH_DETAIL_TOTAL_COLS_PER_BLOCK + MONTH_DETAIL_ANNUAL_LEAVE_COL_COUNT,
    );
    expect(
      payrollMonthlyTimesheetTotalColCount(days, {
        includeAnnualLeaveCols: true,
      }),
    ).toBe(
      MONTHLY_TIMESHEET_STICKY_COL_COUNT +
        days +
        monthlyDetailFlatColCount(true),
    );
    const o = payrollMonthlyTimesheetLayoutOffsets(days, {
      includeAnnualLeaveCols: true,
    });
    expect(o.trialDetailStart).toBe(
      o.totalDetailStart + monthlyDetailTotalColsPerBlock(true),
    );
    expect(
      MONTH_DETAIL_WORKDAY_COL_COUNT +
        MONTH_DETAIL_OT_COL_COUNT +
        MONTH_DETAIL_ANNUAL_LEAVE_COL_COUNT,
    ).toBe(monthlyDetailTotalColsPerBlock(true));
  });
});
