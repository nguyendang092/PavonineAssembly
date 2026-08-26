import { describe, expect, it } from "vitest";
import {
  resolveYearMonthDateRange,
  resolveYearMonthFromDateKey,
} from "./attendanceLeaveScope.js";

describe("attendanceLeaveScope", () => {
  it("resolveYearMonthFromDateKey returns yyyy-mm", () => {
    expect(resolveYearMonthFromDateKey("2026-06-15")).toBe("2026-06");
    expect(resolveYearMonthFromDateKey("bad")).toBeNull();
  });

  it("resolveYearMonthDateRange covers full calendar month", () => {
    expect(resolveYearMonthDateRange("2026-06")).toEqual({
      startAt: "2026-06-01",
      endAt: "2026-06-30",
    });
    expect(resolveYearMonthDateRange("2026-02")).toEqual({
      startAt: "2026-02-01",
      endAt: "2026-02-28",
    });
  });
});
