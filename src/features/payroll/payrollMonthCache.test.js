import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAYROLL_MONTH_CACHE_TTL_MS,
  buildPayrollMonthCacheKey,
  clearPayrollMonthCache,
  getCachedMonth,
  invalidatePayrollMonthCache,
  setCachedMonth,
} from "@/features/payroll/payrollMonthCache";

describe("payrollMonthCache", () => {
  beforeEach(() => {
    clearPayrollMonthCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearPayrollMonthCache();
  });

  it("buildPayrollMonthCacheKey gộp root + tháng", () => {
    const keys = ["2026-06-01", "2026-06-02"];
    expect(buildPayrollMonthCacheKey("attendance", keys)).toBe(
      "attendance:2026-06",
    );
  });

  it("getCachedMonth trả isFresh trong TTL", () => {
    const key = "attendance:2026-06";
    setCachedMonth(key, [{ dateKey: "2026-06-01" }]);
    expect(getCachedMonth(key)?.isFresh).toBe(true);
    vi.advanceTimersByTime(PAYROLL_MONTH_CACHE_TTL_MS - 1);
    expect(getCachedMonth(key)?.isFresh).toBe(true);
    vi.advanceTimersByTime(2);
    expect(getCachedMonth(key)?.isFresh).toBe(false);
  });

  it("invalidatePayrollMonthCache buộc stale nhưng vẫn giữ dayChunks", () => {
    const key = "attendance:2026-06";
    const chunks = [{ dateKey: "2026-06-01" }];
    setCachedMonth(key, chunks);
    invalidatePayrollMonthCache(key);
    const cached = getCachedMonth(key);
    expect(cached?.dayChunks).toEqual(chunks);
    expect(cached?.isFresh).toBe(false);
  });

  it("evict entry cũ nhất khi vượt max entries", () => {
    for (let i = 1; i <= 9; i += 1) {
      vi.setSystemTime(new Date(`2026-0${Math.min(i, 9)}-15T12:00:00`));
      setCachedMonth(`attendance:2026-0${i}`, [{ dateKey: `2026-0${i}-01` }]);
    }
    expect(getCachedMonth("attendance:2026-01")).toBeNull();
    expect(getCachedMonth("attendance:2026-09")).not.toBeNull();
  });
});
