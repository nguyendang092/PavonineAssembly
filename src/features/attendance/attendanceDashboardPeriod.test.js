import { describe, expect, it } from "vitest";
import {
  buildDashboardTrendPoints,
  dedupeRosterEmployees,
  formatDashboardPeriodLabel,
  getWeekEndKey,
  getWeekStartKey,
  listDashboardFetchDateKeys,
  listDashboardPeriodDateKeys,
  normalizeDashboardPeriod,
} from "./attendanceDashboardPeriod";

describe("attendanceDashboardPeriod", () => {
  it("normalizes period ids", () => {
    expect(normalizeDashboardPeriod("week")).toBe("week");
    expect(normalizeDashboardPeriod("invalid")).toBe("day");
    expect(normalizeDashboardPeriod(null)).toBe("day");
  });

  it("week range is Monday through Sunday", () => {
    expect(getWeekStartKey("2026-07-08")).toBe("2026-07-06");
    expect(getWeekEndKey("2026-07-08")).toBe("2026-07-12");
    expect(getWeekStartKey("2026-07-12")).toBe("2026-07-06");
  });

  it("lists period date keys for month and year", () => {
    const monthKeys = listDashboardPeriodDateKeys("month", "2026-07-15");
    expect(monthKeys[0]).toBe("2026-07-01");
    expect(monthKeys.at(-1)).toBe("2026-07-31");
    expect(monthKeys).toHaveLength(31);

    const yearKeys = listDashboardPeriodDateKeys("year", "2026-07-15");
    expect(yearKeys[0]).toBe("2026-01-01");
    expect(yearKeys.at(-1)).toBe("2026-12-31");
    expect(yearKeys).toHaveLength(365);
  });

  it("fetch keys include trend history for day view", () => {
    const keys = listDashboardFetchDateKeys("day", "2026-07-08");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-07-08");
    expect(keys.at(-1)).toBe("2026-07-14");
  });

  it("week trend starts on selected date", () => {
    const points = buildDashboardTrendPoints(
      "week",
      "2026-07-08",
      [
        { dateKey: "2026-07-08", onTime: 10, late: 1, onLeave: 0, absent: 0, total: 11 },
        { dateKey: "2026-07-09", onTime: 8, late: 0, onLeave: 0, absent: 0, total: 8 },
      ],
      "vi-VN",
    );
    expect(points).toHaveLength(7);
    expect(points[0].dateKey).toBe("2026-07-08");
    expect(points[0].onTime).toBe(10);
    expect(points[1].dateKey).toBe("2026-07-09");
    expect(points.at(-1).dateKey).toBe("2026-07-14");
  });

  it("aggregates month trend by week", () => {
    const daily = [
      { dateKey: "2026-07-01", onTime: 10, late: 1, onLeave: 0, absent: 0, total: 11 },
      { dateKey: "2026-07-02", onTime: 8, late: 2, onLeave: 0, absent: 0, total: 10 },
      { dateKey: "2026-07-08", onTime: 5, late: 0, onLeave: 1, absent: 0, total: 6 },
    ];
    const points = buildDashboardTrendPoints("month", "2026-07-15", daily, "vi-VN");
    const firstWeek = points.find((p) => p.dateKey === "2026-06-29");
    expect(firstWeek?.onTime).toBe(18);
    expect(firstWeek?.late).toBe(3);
    expect(firstWeek?.total).toBe(21);
  });

  it("dedupes roster by latest date per employee", () => {
    const roster = dedupeRosterEmployees([
      {
        dateKey: "2026-07-01",
        employees: [{ mnv: "1", hoVaTen: "A", boPhan: "QC" }],
      },
      {
        dateKey: "2026-07-05",
        employees: [{ mnv: "1", hoVaTen: "A", boPhan: "HR" }],
      },
    ]);
    expect(roster).toHaveLength(1);
    expect(roster[0].boPhan).toBe("HR");
  });

  it("formats period label for week range", () => {
    const label = formatDashboardPeriodLabel("week", "2026-07-08", "vi-VN");
    expect(label).toMatch(/06/);
    expect(label).toMatch(/12/);
  });
});
