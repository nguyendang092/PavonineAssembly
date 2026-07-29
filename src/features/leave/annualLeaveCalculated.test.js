import { describe, expect, it, vi, afterEach } from "vitest";
import {
  annualLeaveTenureBonusDays,
  completedYearsFromStartWorkingDate,
  computeAnnualLeaveTotals,
  formatAnnualLeaveMonthColumnLabel,
  isCalendarMonthCompleteBeforeAsOf,
  isStartWorkingDateInCalendarMonth,
  isStartWorkingDateInCalendarYear,
  listAnnualLeaveCalendarYearMonths,
  monthMeetsHalfStandardWorkDays,
  resolveAnnualLeaveAccrualMonthRange,
  resolveAnnualLeaveCurrentYear,
  resolveAnnualLeaveMonthlyAccrualDays,
  resolveAnnualLeaveTenureBonus,
} from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

function accrualMonthMap(year, startMonth, endMonth, workDays, standardWorkDays = 22) {
  const map = {};
  for (let m = startMonth; m <= endMonth; m += 1) {
    map[`${year}-${String(m + 1).padStart(2, "0")}`] = {
      workDays,
      standardWorkDays,
    };
  }
  return map;
}

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

describe("monthMeetsHalfStandardWorkDays", () => {
  it("requires actual work days at least half of standard", () => {
    expect(monthMeetsHalfStandardWorkDays({ workDays: 11, standardWorkDays: 22 })).toBe(
      true,
    );
    expect(monthMeetsHalfStandardWorkDays({ workDays: 10, standardWorkDays: 22 })).toBe(
      false,
    );
    expect(monthMeetsHalfStandardWorkDays(null)).toBe(false);
  });
});

describe("isStartWorkingDateInCalendarMonth", () => {
  it("matches only the join month in the same year", () => {
    expect(isStartWorkingDateInCalendarMonth("2026-03-15", 2026, 2)).toBe(true);
    expect(isStartWorkingDateInCalendarMonth("2026-03-15", 2026, 3)).toBe(false);
    expect(isStartWorkingDateInCalendarMonth("2026-03-15", 2025, 2)).toBe(false);
  });
});

describe("isCalendarMonthCompleteBeforeAsOf", () => {
  it("requires the calendar month to end before as-of date", () => {
    expect(isCalendarMonthCompleteBeforeAsOf(2026, 1, "2026-03-01")).toBe(true);
    expect(isCalendarMonthCompleteBeforeAsOf(2026, 2, "2026-03-01")).toBe(false);
    expect(isCalendarMonthCompleteBeforeAsOf(2026, 2, "2026-04-01")).toBe(true);
  });
});

describe("resolveAnnualLeaveMonthlyAccrualDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 without payroll for new joiners in the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    expect(resolveAnnualLeaveMonthlyAccrualDays("2026-03-15", 2026)).toBe(0);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2026-08-01", 2026)).toBe(0);
  });

  it("accrues +1 per month for veterans without payroll summaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026)).toBe(7);
  });

  it("applies half-day rule only for new joiners in the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const passAll = accrualMonthMap(2026, 0, 6, 14, 22);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026, passAll)).toBe(7);

    const failJuly = {
      ...passAll,
      "2026-07": { workDays: 5, standardWorkDays: 22 },
    };
    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026, failJuly)).toBe(7);

    expect(
      resolveAnnualLeaveMonthlyAccrualDays("2026-03-15", 2026, {
        "2026-03": { workDays: 11, standardWorkDays: 20 },
        "2026-04": { workDays: 4, standardWorkDays: 20 },
        "2026-05": { workDays: 11, standardWorkDays: 20 },
        "2026-06": { workDays: 11, standardWorkDays: 20 },
        "2026-07": { workDays: 11, standardWorkDays: 20 },
      }),
    ).toBe(4);
  });

  it("counts current month when condition is met", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 20));

    expect(
      resolveAnnualLeaveMonthlyAccrualDays("2026-03-15", 2026, {
        "2026-03": { workDays: 11, standardWorkDays: 20 },
      }),
    ).toBe(1);
  });

  it("join 25-Jun-2026 — thiếu ½ ngày công thì 0; đủ thì +1 kể cả tháng hiện tại", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29));

    expect(resolveAnnualLeaveMonthlyAccrualDays("2026-06-25", 2026)).toBe(0);
    expect(
      resolveAnnualLeaveMonthlyAccrualDays("2026-06-25", 2026, {
        "2026-06": { workDays: 4, standardWorkDays: 27 },
      }),
    ).toBe(0);
    expect(
      resolveAnnualLeaveMonthlyAccrualDays("2026-06-25", 2026, {
        "2026-06": { workDays: 14, standardWorkDays: 27 },
      }),
    ).toBe(1);
    expect(
      resolveAnnualLeaveMonthlyAccrualDays("2026-06-25", 2026, {
        "2026-06": { workDays: 4, standardWorkDays: 27 },
        "2026-07": { workDays: 14, standardWorkDays: 27 },
      }),
    ).toBe(1);
  });

  it("resets accrual for a new calendar year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24));

    const passAll2025 = accrualMonthMap(2025, 0, 11, 14, 22);
    const passJanJul2026 = accrualMonthMap(2026, 0, 6, 14, 22);

    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2025, passAll2025)).toBe(12);
    expect(resolveAnnualLeaveMonthlyAccrualDays("2016-01-10", 2026, passJanJul2026)).toBe(7);
  });

  it("detects start date in calendar year", () => {
    expect(isStartWorkingDateInCalendarYear("2026-03-15", 2026)).toBe(true);
    expect(isStartWorkingDateInCalendarYear("2016-01-10", 2026)).toBe(false);
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
    const passAll = accrualMonthMap(2026, 0, 6, 14, 22);
    expect(
      resolveAnnualLeaveTenureBonus(
        row[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
        2026,
      ),
    ).toBe(2);
    expect(
      resolveAnnualLeaveCurrentYear(row, 2026, {
        monthWorkSummaryByYearMonth: passAll,
      }),
    ).toBe(9);
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
