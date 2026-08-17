import { describe, expect, it } from "vitest";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  buildMonthlyRuleSummary,
  pickPayrollMonthlyTimesheetTotalWorkColumns,
  payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  buildAnnualLeaveMonthWorkSummary,
  buildAnnualLeaveMonthWorkSummaryByEmpKey,
  listCalendarDateKeysForYearMonth,
  mergeAttendanceRootsForPayrollAccrual,
  resolveJoinYearMonthKey,
} from "./annualLeavePayrollAccrual";
import {
  monthMeetsHalfStandardWorkDays,
} from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

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

describe("mergeAttendanceRootsForPayrollAccrual", () => {
  it("overlays full accrual-month days onto scoped attendance snapshot", () => {
    const scoped = {
      "2026-08-17": { emp_A: { mnv: "A" } },
    };
    const fullMonth = {
      "2026-08-22": {
        _meta: { isCompensatoryDay: true },
        emp_B: { mnv: "B" },
      },
    };
    expect(mergeAttendanceRootsForPayrollAccrual(scoped, fullMonth)).toEqual({
      "2026-08-17": { emp_A: { mnv: "A" } },
      "2026-08-22": fullMonth["2026-08-22"],
    });
  });

  it("merged root unlocks August +1 when scoped snapshot stops at today", () => {
    const yearData = {
      emp_160714: {
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "160714",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-07-01",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 10,
      },
    };
    const scopedRoot = {};
    const accrualMonthRoot = {};
    for (const dateKey of listCalendarDateKeysForYearMonth("2026-08")) {
      if (dateKey > "2026-08-14") continue;
      scopedRoot[dateKey] = {
        emp_160714: {
          mnv: "160714",
          gioVao: "07:30",
          gioRa: "17:05",
          caLamViec: "S1",
        },
      };
      accrualMonthRoot[dateKey] = scopedRoot[dateKey];
    }
    accrualMonthRoot["2026-08-22"] = {
      _meta: { isCompensatoryDay: true },
      emp_999: { mnv: "999", gioVao: "07:00", gioRa: "17:00" },
    };

    const scopedOnly = buildAnnualLeaveMonthWorkSummaryByEmpKey(
      scopedRoot,
      2026,
      yearData,
    );
    const merged = buildAnnualLeaveMonthWorkSummaryByEmpKey(
      mergeAttendanceRootsForPayrollAccrual(scopedRoot, accrualMonthRoot),
      2026,
      yearData,
    );

    const scopedAug = scopedOnly.emp_160714?.["2026-08"];
    const mergedAug = merged.emp_160714?.["2026-08"];
    expect(mergedAug?.workDays ?? 0).toBe((scopedAug?.workDays ?? 0) + 1);
    expect(monthMeetsHalfStandardWorkDays(mergedAug)).toBe(true);
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
      "100",
      { ngayVaoLam: "2026-03-10" },
    );

    expect(summary).not.toBeNull();
    expect(summary).toEqual(pickPayrollMonthlyTimesheetTotalWorkColumns(total));
    expect(
      monthMeetsHalfStandardWorkDays(summary),
    ).toBe(payrollMonthlyJoinMonthMeetsAnnualLeaveAccrual(total));
  });

  it("maps emp_{mnv} to payroll row id so attendance is found", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-07");
    const dayChunkMap = new Map();
    for (const dateKey of monthKeys) {
      if (dateKey < "2026-07-01" || dateKey > "2026-07-15") continue;
      const raw = {
        emp_260638: {
          mnv: "260638",
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
      "2026-07",
      "emp_260638",
      "2026-06-18",
    );

    const { total } = buildMonthlyRuleSummary(
      dayChunkMap,
      monthKeys,
      "260638",
      { ngayVaoLam: "2026-06-18" },
    );

    expect(summary).toEqual(pickPayrollMonthlyTimesheetTotalWorkColumns(total));
    expect(summary?.workDays).toBeGreaterThan(0);
  });

  it("builds summary without stored start date using attendance profile", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-06");
    const dayChunkMap = new Map();
    for (const dateKey of monthKeys) {
      if (dateKey < "2026-06-01" || dateKey > "2026-06-15") continue;
      const raw = {
        emp_160701: {
          mnv: "160701",
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
      "emp_160701",
      "",
    );

    expect(summary).not.toBeNull();
    expect(summary?.workDays).toBeGreaterThan(0);
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

  it("adds compensatory calendar credit when accrual month includes nghỉ bù", () => {
    const monthKeys = listCalendarDateKeysForYearMonth("2026-08");
    const dayChunkMap = new Map();
    for (const dateKey of monthKeys) {
      if (dateKey > "2026-08-14") continue;
      const raw = {
        emp_160714: {
          mnv: "160714",
          gioVao: "07:30",
          gioRa: "17:05",
          caLamViec: "S1",
        },
      };
      const chunk = buildPayrollMonthDayChunkFromRaw(raw, dateKey);
      if (chunk) dayChunkMap.set(dateKey, chunk);
    }

    const before = buildAnnualLeaveMonthWorkSummary(
      dayChunkMap,
      "2026-08",
      "emp_160714",
      "2016-07-01",
    );
    dayChunkMap.set(
      "2026-08-22",
      buildPayrollMonthDayChunkFromRaw(
        {
          _meta: { isCompensatoryDay: true },
          emp_999: { mnv: "999", gioVao: "07:00", gioRa: "17:00" },
        },
        "2026-08-22",
      ),
    );
    const after = buildAnnualLeaveMonthWorkSummary(
      dayChunkMap,
      "2026-08",
      "emp_160714",
      "2016-07-01",
    );

    expect(after?.workDays).toBe((before?.workDays ?? 0) + 1);
    expect(monthMeetsHalfStandardWorkDays(after)).toBe(true);
  });
});
