import { describe, expect, it } from "vitest";
import {
  buildPayrollMonthlyTimesheetExcelBorders,
  getPayrollMonthlyTimesheetDayHeaderBg,
  PTS_COLORS,
} from "./payrollMonthlyTimesheetGridStyle";
import { payrollMonthlyTimesheetLayoutOffsets } from "./payrollMonthlyTimesheetLayout";

describe("payrollMonthlyTimesheetGridStyle", () => {
  it("colors Sunday header like grid", () => {
    const sun = new Date(2026, 4, 3);
    expect(getPayrollMonthlyTimesheetDayHeaderBg(sun, null)).toBe(
      PTS_COLORS.daySunHeader,
    );
  });

  it("strong left on first detail column", () => {
    const layout = payrollMonthlyTimesheetLayoutOffsets(31);
    const border = buildPayrollMonthlyTimesheetExcelBorders({
      row1Based: 5,
      col1Based: layout.totalDetailStart + 1,
      maxRow: 10,
      maxCol: layout.totalCols,
      layout,
      headerRowCount: 3,
      subrowCount: 7,
      subrowIndex: 0,
      monthKeyCount: 31,
    });
    expect(border.left.style).toBe("medium");
    expect(border.left.color.argb).toBe(PTS_COLORS.black);
  });
});
