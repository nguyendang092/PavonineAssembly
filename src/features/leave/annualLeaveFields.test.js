import { describe, expect, it, vi, afterEach } from "vitest";
import {
  annualLeaveAttendanceCountStartDate,
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
  listAnnualLeaveCountYearMonths,
  listAnnualLeaveDetailDisplayMonths,
  listAnnualLeaveDetailHistoryMonths,
  listAnnualLeaveDetailRecentMonths,
  listAnnualLeavePreCountDisplayMonthKeys,
  resolveAnnualLeaveDetailThroughDateKey,
} from "./annualLeaveFields";

describe("annualLeave attendance count start", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("2026 starts on 2026-06-01", () => {
    expect(annualLeaveAttendanceCountStartDate(2026)).toBe("2026-06-01");
  });

  it("years after 2026 start on Jan 1", () => {
    expect(annualLeaveAttendanceCountStartDate(2027)).toBe("2027-01-01");
  });

  it("skips trial dates before June 2026", () => {
    expect(isAttendanceDateCountedForAnnualLeave("2026-05-31", 2026)).toBe(false);
    expect(isAttendanceDateCountedForAnnualLeave("2026-06-01", 2026)).toBe(true);
    expect(isAttendanceDateCountedForAnnualLeave("2026-06-15", 2026)).toBe(true);
    expect(isAttendanceDateDisplayOnlyForAnnualLeave("2026-05-31", 2026)).toBe(
      true,
    );
    expect(isAttendanceDateDisplayOnlyForAnnualLeave("2026-06-01", 2026)).toBe(
      false,
    );
  });

  it("lists pre-count display months before official start", () => {
    expect(listAnnualLeavePreCountDisplayMonthKeys(2026)).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
    ]);
    expect(listAnnualLeavePreCountDisplayMonthKeys(2027)).toEqual([]);
  });

  it("lists months from official start through throughDateKey or year end", () => {
    expect(listAnnualLeaveCountYearMonths(2026, "2026-08-01")).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(listAnnualLeaveCountYearMonths(2026)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("detail history months: full counted period newest first", () => {
    expect(
      listAnnualLeaveDetailHistoryMonths(2026, "2026-08-15"),
    ).toEqual(["2026-08", "2026-07", "2026-06"]);
    expect(listAnnualLeaveDetailHistoryMonths(2026, "2026-06-01")).toEqual([
      "2026-06",
    ]);
  });

  it("detail recent months: three newest by default", () => {
    expect(
      listAnnualLeaveDetailRecentMonths(2026, "2026-08-15"),
    ).toEqual(["2026-08", "2026-07", "2026-06"]);
    expect(listAnnualLeaveDetailRecentMonths(2027, "2027-05-01")).toEqual([
      "2027-05",
      "2027-04",
      "2027-03",
    ]);
  });

  it("legacy detail display months keeps two-month slice", () => {
    expect(
      listAnnualLeaveDetailDisplayMonths(2026, "2026-08-15"),
    ).toEqual(["2026-08", "2026-07"]);
  });

  it("resolve detail through date defaults to today in current year", () => {
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
      "2026-08-10T12:00:00.000Z",
    );
    expect(resolveAnnualLeaveDetailThroughDateKey(2026)).toBe("2026-08-10");
    expect(
      listAnnualLeaveDetailRecentMonths(2026, "2026-08-10"),
    ).toEqual(["2026-08", "2026-07", "2026-06"]);
  });
});
