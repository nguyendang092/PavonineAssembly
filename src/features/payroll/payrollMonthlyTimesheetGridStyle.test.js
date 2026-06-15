import { describe, expect, it } from "vitest";
import {
  buildPayrollMonthlyTimesheetExcelBorders,
  getPayrollMonthlyTimesheetDayBodyBg,
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

  it("ngày off dùng cùng màu header/body như chủ nhật", () => {
    const wed = new Date(2026, 0, 7);
    const ch = { isOffDay: true, isHolidayDay: false, isCompensatoryDay: false };
    expect(getPayrollMonthlyTimesheetDayHeaderBg(wed, ch)).toBe(
      PTS_COLORS.daySunHeader,
    );
    expect(
      getPayrollMonthlyTimesheetDayBodyBg(wed, ch),
    ).toBe(PTS_COLORS.daySunBody);
  });

  it("thứ 7 bình thường — xám; thứ 7 OFF — vàng như chủ nhật", () => {
    const sat = new Date(2026, 0, 10);
    expect(getPayrollMonthlyTimesheetDayHeaderBg(sat, null)).toBe(
      PTS_COLORS.daySatHeader,
    );
    expect(getPayrollMonthlyTimesheetDayBodyBg(sat, null)).toBe(
      PTS_COLORS.daySatBody,
    );
    const satOff = {
      isOffDay: true,
      isHolidayDay: false,
      isCompensatoryDay: false,
    };
    expect(getPayrollMonthlyTimesheetDayHeaderBg(sat, satOff)).toBe(
      PTS_COLORS.dayOffHeader,
    );
    expect(getPayrollMonthlyTimesheetDayBodyBg(sat, satOff)).toBe(
      PTS_COLORS.dayOffBody,
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
