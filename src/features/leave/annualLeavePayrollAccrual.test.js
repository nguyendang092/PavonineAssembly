import { describe, expect, it } from "vitest";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildMonthlyRuleSummary,
  pickPayrollMonthlyTimesheetTotalWorkColumns,
  payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  buildAnnualLeaveMonthWorkSummary,
  listCalendarDateKeysForYearMonth,
  resolveJoinYearMonthKey,
} from "./annualLeavePayrollAccrual";
import { monthMeetsHalfStandardWorkDays } from "./annualLeaveCalculated";

describe("listCalendarDateKeysForYearMonth", () => {
  it("lists all days in the month", () => {
    expect(listCalendarDateKeysForYearMonth("2026-02")).toHaveLength(28);
    expect(listCalendarDateKeysForYearMonth("2026-02")[0]).toBe("2026-02-01");
  });
});

describe("resolveJoinYearMonthKey", () => {
  it("accepts Excel-style join dates", () => {
    expect(resolveJoinYearMonthKey("18-Jun-2026", 2026)).toBe("2026-06");
    expect(resolveJoinYearMonthKey("2016-01-10", 2026)).toBe(null);
  });
});

describe("buildAnnualLeaveMonthWorkSummary", () => {
  it("uses payroll monthly totals for join month", () => {
    const dayChunkMap = new Map();
    for (const dateKey of listCalendarDateKeysForYearMonth("2026-03")) {
      const raw = {
        emp_100: {
          mnv: "100",
          gioVao: "08:00",
          gioRa: "17:00",
          caLamViec: "S1",
        },
      };
      const chunk = buildPayrollMonthDayChunkFromRaw(raw, dateKey);
      if (chunk) dayChunkMap.set(dateKey, chunk);
    }

    const summary = buildAnnualLeaveMonthWorkSummary(
      dayChunkMap,
      "2026-03",
      "emp_100",
      "2026-03-10",
    );

    const { total } = buildMonthlyRuleSummary(
      dayChunkMap,
      listCalendarDateKeysForYearMonth("2026-03"),
      "emp_100",
      { ngayVaoLam: "2026-03-10" },
    );

    expect(summary).not.toBeNull();
    expect(summary).toEqual(pickPayrollMonthlyTimesheetTotalWorkColumns(total));
    expect(
      monthMeetsHalfStandardWorkDays(summary),
    ).toBe(payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(total));
  });

  it("join cuối tháng 6 — so ½ với ngày công cả tháng, không chỉ từ ngày vào làm", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-06");
    const dayChunkMap = new Map();
    for (const dateKey of monthKeys) {
      if (dateKey < "2026-06-25") continue;
      const raw = {
        emp_100: {
          mnv: "100",
          gioVao: "08:00",
          gioRa: "17:00",
          caLamViec: "S1",
        },
      };
      const chunk = buildPayrollMonthDayChunkFromRaw(raw, dateKey);
      if (chunk) dayChunkMap.set(dateKey, chunk);
    }

    const summary = buildAnnualLeaveMonthWorkSummary(
      dayChunkMap,
      "2026-06",
      "emp_100",
      "2026-06-25",
    );

    const { total } = buildMonthlyRuleSummary(
      dayChunkMap,
      monthKeys,
      "emp_100",
      { ngayVaoLam: "2026-06-25" },
    );

    expect(summary).toEqual(pickPayrollMonthlyTimesheetTotalWorkColumns(total));
    expect(payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(total)).toBe(false);
    expect(monthMeetsHalfStandardWorkDays(summary)).toBe(false);
  });
});
