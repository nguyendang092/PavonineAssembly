import { describe, expect, it, vi, afterEach } from "vitest";
import {
  annualLeavePathForDateKey,
  attendanceListDateForAnnualLeaveYear,
  attendanceListPathForAnnualLeaveYear,
  payrollPathForDateKey,
} from "./annualLeaveCrossLinks";

describe("annualLeaveCrossLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds annual leave path from attendance date", () => {
    expect(annualLeavePathForDateKey("2026-06-15")).toBe("/annual-leave?year=2026");
  });

  it("uses today when year matches current calendar year", () => {
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-03-10T12:00:00.000Z");
    expect(attendanceListDateForAnnualLeaveYear(2026)).toBe("2026-03-10");
    expect(attendanceListPathForAnnualLeaveYear(2026)).toBe(
      "/attendance-list?date=2026-03-10",
    );
  });

  it("uses count start when year differs from today", () => {
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-03-10T12:00:00.000Z");
    expect(attendanceListDateForAnnualLeaveYear(2025)).toBe("2025-01-01");
  });

  it("builds payroll path with encoded date", () => {
    expect(payrollPathForDateKey("2026-06-01")).toBe(
      "/attendance-salary?date=2026-06-01",
    );
  });
});
