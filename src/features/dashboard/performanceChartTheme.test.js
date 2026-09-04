import { describe, expect, it } from "vitest";
import {
  buildPerformanceKpiSummary,
  resolveAchievementStatus,
} from "./performanceChartTheme";

describe("resolveAchievementStatus", () => {
  it("maps thresholds to good, warn, bad", () => {
    expect(resolveAchievementStatus(100).level).toBe("good");
    expect(resolveAchievementStatus(99).level).toBe("warn");
    expect(resolveAchievementStatus(75).level).toBe("warn");
    expect(resolveAchievementStatus(74).level).toBe("bad");
  });
});

describe("buildPerformanceKpiSummary", () => {
  it("aggregates team metrics", () => {
    const summary = buildPerformanceKpiSummary(
      [
        {
          team: "PRESS",
          target: 100,
          weeks: { W1: 50, W2: 60 },
        },
        {
          team: "MC",
          target: 50,
          weeks: { W1: 30, W2: 25 },
        },
      ],
      3,
    );

    expect(summary.cumulativeTotal).toBe(165);
    expect(summary.cumulativeTarget).toBe(150);
    expect(summary.weekTotal).toBe(85);
    expect(summary.goodTeams).toBe(2);
  });
});
