import { describe, expect, it } from "vitest";
import {
  ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS,
  isAnnualLeaveDailySyncLockActive,
  resolveAnnualLeaveDailySyncClaim,
} from "./annualLeaveDailySyncLock";

describe("annualLeaveDailySyncLock many clients", () => {
  const today = "2026-10-02";
  const now = Date.parse("2026-10-02T08:00:00.000Z");

  it("only one of many sequential claimants wins", () => {
    let lock = null;
    const actions = [];
    for (let i = 1; i <= 12; i += 1) {
      const decision = resolveAnnualLeaveDailySyncClaim(
        lock,
        today,
        now,
        `user${i}@x`,
      );
      actions.push(decision.action);
      if (decision.action === "claim") lock = decision.next;
    }
    expect(actions.filter((action) => action === "claim")).toHaveLength(1);
    expect(actions.filter((action) => action === "skip")).toHaveLength(11);
    expect(isAnnualLeaveDailySyncLockActive(lock, now)).toBe(true);
  });

  it("all later clients skip while lock is fresh", () => {
    const lock = resolveAnnualLeaveDailySyncClaim(null, today, now, "first@x")
      .next;
    for (let i = 0; i < 20; i += 1) {
      expect(
        resolveAnnualLeaveDailySyncClaim(lock, today, now + i, `u${i}@x`),
      ).toEqual({ action: "skip", reason: "in_progress" });
    }
  });

  it("lock is inactive after stale in-progress", () => {
    const lock = {
      inProgressDateKey: today,
      inProgressAt: new Date(
        now - ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS - 1,
      ).toISOString(),
    };
    expect(isAnnualLeaveDailySyncLockActive(lock, now)).toBe(false);
  });
});
