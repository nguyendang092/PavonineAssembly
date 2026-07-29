import { describe, expect, it, vi, afterEach } from "vitest";
import {
  annualLeaveTenureBonusDays,
  completedYearsFromStartWorkingDate,
  computeAnnualLeaveTotals,
  formatAnnualLeaveMonthColumnLabel,
  listAnnualLeaveCalendarYearMonths,
  resolveAnnualLeaveCurrentYear,
  resolveAnnualLeaveMonthlyAccrualDays,
  resolveAnnualLeaveTenureBonus,
} from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

describe("listAnnualLeaveCalendarYearMonths", () => {
  it("returns 12 yyyy-mm keys for the year", () => {
    expect(listAnnualLeaveCalendarYearMonths(2026)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });
});

describe("formatAnnualLeaveMonthColumnLabel", () => {
  it("formats as Mon-yy", () => {
    expect(formatAnnualLeaveMonthColumnLabel("2026-01")).toBe("Jan-26");
    expect(formatAnnualLeaveMonthColumnLabel("2026-12")).toBe("Dec-26");
  });
});

describe("annualLeaveTenureBonusDays", () => {
  it("returns +1 at 5 years and +2 at 10 years", () => {
    expect(annualLeaveTenureBonusDays(4)).toBe(0);
    expect(annualLeaveTenureBonusDays(5)).toBe(1);
    expect(annualLeaveTenureBonusDays(9)).toBe(1);
    expect(annualLeaveTenureBonusDays(10)).toBe(2);
  });
});

describe("completedYearsFromStartWorkingDate", () => {
  it("counts full years after join anniversary", () => {
    expect(
      completedYearsFromStartWorkingDate("2016-06-15", "2026-06-14"),
    ).toBe(9);
    expect(
      completedYearsFromStartWorkingDate("2016-06-15", "2026-06-15"),
    ).toBe(10);
  });
});

describe("resolveAnnualLeaveMonthlyAccrualDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accrues 1 day per calendar month in the selected year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026)).toBe(7);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2026-03-15", 2026)).toBe(5);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2026-08-01", 2026)).toBe(0);
  });

  it("resets accrual for a new calendar year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2025)).toBe(12);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026)).toBe(7);
  });
});

describe("resolveAnnualLeaveCurrentYear", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to stored value when start date is missing", () => {
    const row = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "",
    };
    expect(resolveAnnualLeaveCurrentYear(row, 2026)).toBe(12);
  });

  it("adds monthly accrual and tenure bonus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const row = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 99,
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-10",
    };
    expect(
      resolveAnnualLeaveTenureBonus(
        row[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
        2026,
      ),
    ).toBe(2);
    expect(resolveAnnualLeaveCurrentYear(row, 2026)).toBe(9);
  });
});

describe("computeAnnualLeaveTotals", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tổng = phép năm + bonus + nghỉ bù; balance = tổng - đã dùng", () => {
    const row = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 7,
      [ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]: 0,
      [ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]: 0,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3.5,
    };
    const t = computeAnnualLeaveTotals(row);
    expect(t[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(7);
    expect(t[ANNUAL_LEAVE_EMP.BALANCE]).toBe(3.5);
  });

  it("uses monthly accrual when year is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const row = {
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
      [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-03-01",
      [ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]: 0,
      [ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]: 0,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
    };
    const t = computeAnnualLeaveTotals(row, 2026);
    expect(t[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]).toBe(9);
  });
});
