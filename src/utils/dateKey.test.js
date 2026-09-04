import { describe, expect, it, vi, afterEach } from "vitest";
import { getTodayDateKeyLocal, msUntilNextLocalMidnight } from "@/utils/dateKey";

describe("msUntilNextLocalMidnight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns positive ms until next local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 14, 30, 0));
    const ms = msUntilNextLocalMidnight();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(10 * 60 * 60 * 1000);
    vi.useRealTimers();
  });
});

describe("getTodayDateKeyLocal", () => {
  it("formats local calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 23, 59, 0));
    expect(getTodayDateKeyLocal()).toBe("2026-09-03");
    vi.useRealTimers();
  });
});
