import { describe, expect, it } from "vitest";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildAnnualLeaveJoinMonthWorkSummary,
  listCalendarDateKeysForYearMonth,
} from "./annualLeavePayrollAccrual";

describe("listCalendarDateKeysForYearMonth", () => {
  it("lists all days in the month", () => {
    expect(listCalendarDateKeysForYearMonth("2026-02")).toHaveLength(28);
    expect(listCalendarDateKeysForYearMonth("2026-02")[0]).toBe("2026-02-01");
  });
});

describe("buildAnnualLeaveJoinMonthWorkSummary", () => {
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

    const summary = buildAnnualLeaveJoinMonthWorkSummary(
      dayChunkMap,
      "2026-03",
      "emp_100",
      "2026-03-10",
    );

    expect(summary).not.toBeNull();
    expect(summary.standardWorkDays).toBeGreaterThan(0);
    expect(summary.workDays).toBeGreaterThan(0);
  });
});
