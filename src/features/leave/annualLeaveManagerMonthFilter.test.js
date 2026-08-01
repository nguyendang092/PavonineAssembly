import { describe, expect, it } from "vitest";
import {
  filterAnnualLeaveManagerMonthColumnLabels,
  filterAnnualLeaveManagerMonthValues,
  parseAnnualLeaveManagerMonthFilter,
  resolveAnnualLeaveManagerMonthIndex,
  resolveAnnualLeaveManagerThroughDateKey,
} from "./annualLeaveManagerMonthFilter";

describe("annualLeaveManagerMonthFilter", () => {
  it("parseAnnualLeaveManagerMonthFilter normalizes month values", () => {
    expect(parseAnnualLeaveManagerMonthFilter("")).toBe("");
    expect(parseAnnualLeaveManagerMonthFilter("6")).toBe("06");
    expect(parseAnnualLeaveManagerMonthFilter("12")).toBe("12");
    expect(parseAnnualLeaveManagerMonthFilter("13")).toBe("");
  });

  it("resolveAnnualLeaveManagerThroughDateKey uses month end or today", () => {
    expect(resolveAnnualLeaveManagerThroughDateKey(2026, "")).toMatch(/^2026-/);
    expect(resolveAnnualLeaveManagerThroughDateKey(2026, "06")).toMatch(
      /^2026-06-/,
    );
  });

  it("filters month columns and values to one month", () => {
    const labels = ["Jan-26", "Feb-26", "Mar-26"];
    expect(filterAnnualLeaveManagerMonthColumnLabels(labels, "02")).toEqual([
      "Feb-26",
    ]);
    expect(filterAnnualLeaveManagerMonthValues([1, 2, 3], "02")).toEqual([2]);
    expect(resolveAnnualLeaveManagerMonthIndex("03")).toBe(2);
  });
});
