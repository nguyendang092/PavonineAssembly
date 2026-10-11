import { describe, expect, it } from "vitest";
import { ANNUAL_LEAVE_EMP } from "@/features/leave/annualLeaveFields";
import {
  buildPayrollMonthlyTimesheetAnnualLeaveColsByRowId,
  resolvePayrollMonthlyTimesheetAnnualLeaveCols,
} from "./payrollMonthlyTimesheetAnnualLeaveCols";

describe("resolvePayrollMonthlyTimesheetAnnualLeaveCols", () => {
  it("shows 1 / remaining when half-rule month qualifies and AL row exists", () => {
    const cols = resolvePayrollMonthlyTimesheetAnnualLeaveCols({
      rowId: "emp_9001",
      rep: { mnv: "9001", ngayVaoLam: "2020-01-10" },
      totalSummary: { workDays: 13, standardWorkDays: 26, tsDays: 0 },
      year: 2026,
      monthIndex: 9,
      annualLeaveByEmpKey: {
        emp_9001: {
          recordId: "emp_9001",
          raw: {
            [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "9001",
            [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2020-01-10",
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
            [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 3,
          },
        },
      },
      monthlyUsageByEmpKey: {
        emp_9001: [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      },
    });
    expect(cols.monthGrant).toBe(1);
    expect(cols.balanceDisplay).toBe("9.00");
  });

  it("uses stored monthly usage on the AL row when merge map is absent", () => {
    const cols = resolvePayrollMonthlyTimesheetAnnualLeaveCols({
      rowId: "emp_9003",
      rep: { mnv: "9003", ngayVaoLam: "2020-01-10" },
      totalSummary: { workDays: 13, standardWorkDays: 26, tsDays: 0 },
      year: 2026,
      monthIndex: 9,
      annualLeaveByEmpKey: {
        emp_9003: {
          recordId: "emp_9003",
          raw: {
            [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "9003",
            [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2020-01-10",
            [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
            [ANNUAL_LEAVE_EMP.MONTHLY_LEAVE_USAGE]: [
              1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
            ],
          },
        },
      },
    });
    expect(cols.monthGrant).toBe(1);
    expect(cols.balanceDisplay).toBe("7.00");
  });

  it("reuses the previous column object when values do not change", () => {
    const previous = new Map([
      [
        "emp_1",
        { monthGrant: 1, balanceDisplay: "12.00" },
      ],
    ]);
    const map = buildPayrollMonthlyTimesheetAnnualLeaveColsByRowId({
      year: 2026,
      monthIndex: 5,
      ids: ["emp_1"],
      repById: new Map([
        ["emp_1", { mnv: "1", ngayVaoLam: "2018-03-01" }],
      ]),
      summaryById: new Map([
        [
          "emp_1",
          { total: { workDays: 14, standardWorkDays: 22, tsDays: 0 } },
        ],
      ]),
      annualLeaveYearData: {
        emp_1: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "1",
          [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2018-03-01",
          [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 14,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
        },
      },
      leaveAggYearData: null,
      previousByRowId: previous,
    });
    expect(map.get("emp_1")).toBe(previous.get("emp_1"));
  });

  it("shows 0 and dash when month does not qualify and no AL record", () => {
    const cols = resolvePayrollMonthlyTimesheetAnnualLeaveCols({
      rowId: "emp_9002",
      rep: { mnv: "9002", ngayVaoLam: "2020-01-10" },
      totalSummary: { workDays: 10, standardWorkDays: 26, tsDays: 0 },
      year: 2026,
      monthIndex: 9,
      annualLeaveByEmpKey: {},
      monthlyUsageByEmpKey: {},
    });
    expect(cols.monthGrant).toBe(0);
    expect(cols.balanceDisplay).toBe("—");
  });
});

describe("buildPayrollMonthlyTimesheetAnnualLeaveColsByRowId", () => {
  it("indexes employees by timesheet row id", () => {
    const map = buildPayrollMonthlyTimesheetAnnualLeaveColsByRowId({
      year: 2026,
      monthIndex: 5,
      ids: ["emp_1"],
      repById: new Map([
        ["emp_1", { mnv: "1", ngayVaoLam: "2018-03-01" }],
      ]),
      summaryById: new Map([
        [
          "emp_1",
          { total: { workDays: 14, standardWorkDays: 22, tsDays: 0 } },
        ],
      ]),
      annualLeaveYearData: {
        emp_1: {
          [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "1",
          [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2018-03-01",
          [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 14,
          [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 2,
        },
      },
      leaveAggYearData: null,
    });
    expect(map.get("emp_1").monthGrant).toBe(1);
    expect(map.get("emp_1").balanceDisplay).toBe("12.00");
  });
});
