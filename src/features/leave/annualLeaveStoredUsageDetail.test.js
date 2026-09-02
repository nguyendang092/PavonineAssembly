import { describe, expect, it } from "vitest";
import { ATTENDANCE_LEAVE_AGG_EMP } from "./attendanceLeaveAggFields";
import {
  filterStoredAnnualLeaveUsageDetail,
  readAnnualLeaveUsageDetailFromLeaveAggEmp,
  serializeAnnualLeaveUsageDetailForLeaveAgg,
} from "./annualLeaveStoredUsageDetail";

describe("annualLeaveStoredUsageDetail", () => {
  const sampleDetail = {
    totalPn: 2,
    totalHalfPn: 1,
    totalDeduction: 2.5,
    months: [
      {
        yearMonth: "2026-06",
        pnCount: 1,
        halfPnCount: 0,
        totalDeduction: 1,
        displayOnly: false,
        days: [{ dateKey: "2026-06-10", type: "PN", deduction: 1 }],
      },
      {
        yearMonth: "2026-07",
        pnCount: 1,
        halfPnCount: 1,
        totalDeduction: 1.5,
        displayOnly: false,
        days: [
          { dateKey: "2026-07-05", type: "PN", deduction: 1 },
          { dateKey: "2026-07-20", type: "1/2PN", deduction: 0.5 },
        ],
      },
    ],
  };

  it("serializeAnnualLeaveUsageDetailForLeaveAgg rounds and packs months", () => {
    const packed = serializeAnnualLeaveUsageDetailForLeaveAgg(sampleDetail);
    expect(packed.totalDeduction).toBe(2.5);
    expect(packed.months).toHaveLength(2);
    expect(packed.months[0].days[0]).toEqual({
      dateKey: "2026-06-10",
      type: "PN",
      deduction: 1,
      displayOnly: false,
    });
  });

  it("filterStoredAnnualLeaveUsageDetail applies throughDateKey", () => {
    const stored = serializeAnnualLeaveUsageDetailForLeaveAgg(sampleDetail);
    const filtered = filterStoredAnnualLeaveUsageDetail(stored, 2026, {
      throughDateKey: "2026-06-30",
    });

    expect(filtered.totalPn).toBe(1);
    expect(filtered.totalHalfPn).toBe(0);
    expect(filtered.totalDeduction).toBe(1);
    expect(filtered.months.some((m) => m.yearMonth === "2026-07")).toBe(false);
    const june = filtered.months.find((m) => m.yearMonth === "2026-06");
    expect(june?.days).toHaveLength(1);
  });

  it("readAnnualLeaveUsageDetailFromLeaveAggEmp reads stored usageDetail", () => {
    const empNode = {
      [ATTENDANCE_LEAVE_AGG_EMP.USAGE_DETAIL]:
        serializeAnnualLeaveUsageDetailForLeaveAgg(sampleDetail),
    };

    const detail = readAnnualLeaveUsageDetailFromLeaveAggEmp(empNode, 2026);
    expect(detail.totalDeduction).toBe(2.5);
    expect(
      detail.months.some((m) => m.yearMonth === "2026-07" && m.days.length === 2),
    ).toBe(true);
  });

  it("readAnnualLeaveUsageDetailFromLeaveAggEmp falls back to deductionByMonth", () => {
    const empNode = {
      [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: {
        "06": 1,
        "07": 0.5,
      },
    };

    const detail = readAnnualLeaveUsageDetailFromLeaveAggEmp(empNode, 2026);
    expect(detail.totalDeduction).toBe(1.5);
    expect(detail.totalPn).toBe(0);
    expect(detail.months.every((m) => m.days.length === 0)).toBe(true);
  });
});
