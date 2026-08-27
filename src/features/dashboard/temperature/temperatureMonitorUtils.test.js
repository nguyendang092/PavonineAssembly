import { describe, expect, it } from "vitest";
import {
  evaluateDayStatus,
  evaluateMetricStatus,
  navBadgeForSummary,
  splitWorkingDays,
  summarizeMachineMonth,
} from "./temperatureMonitorUtils";
import { TEMPERATURE_METRIC_THRESHOLDS } from "./temperatureMonitorConstants";

describe("temperatureMonitorUtils", () => {
  it("splitWorkingDays splits at day 16", () => {
    const days = [
      new Date("2026-03-01"),
      new Date("2026-03-16"),
      new Date("2026-03-17"),
    ];
    const { firstHalf, secondHalf } = splitWorkingDays(days);
    expect(firstHalf).toHaveLength(2);
    expect(secondHalf).toHaveLength(1);
  });

  it("evaluateMetricStatus respects warn margin", () => {
    const { temperature } = TEMPERATURE_METRIC_THRESHOLDS;
    expect(evaluateMetricStatus(20, temperature)).toBe("ok");
    expect(evaluateMetricStatus(17, temperature)).toBe("warn");
    expect(evaluateMetricStatus(16, temperature)).toBe("danger");
  });

  it("evaluateDayStatus picks worst status", () => {
    expect(evaluateDayStatus(20, 50)).toBe("ok");
    expect(evaluateDayStatus(16, 50)).toBe("danger");
    expect(evaluateDayStatus("", "")).toBe("empty");
  });

  it("navBadgeForSummary prioritizes alert", () => {
    expect(navBadgeForSummary({ filled: 5, alerts: 1 })).toBe("alert");
    expect(navBadgeForSummary({ filled: 3, alerts: 0 })).toBe("done");
    expect(navBadgeForSummary({ filled: 0, alerts: 0 })).toBe("todo");
  });

  it("summarizeMachineMonth counts filled and alerts", () => {
    const data = {
      temperature: { "02": 20, "03": 16 },
      humidity: { "02": 50, "03": 50 },
    };
    const summary = summarizeMachineMonth(data, "2026-02");
    expect(summary.filled).toBe(2);
    expect(summary.alerts).toBe(1);
  });
});
