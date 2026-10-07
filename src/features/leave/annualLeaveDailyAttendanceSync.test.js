import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import {
  ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS,
  annualLeaveDailySyncLockPath,
  resolveAnnualLeaveDailySyncClaim,
  syncAnnualLeaveForLocalDayRollover,
} from "./annualLeaveDailyAttendanceSync";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock("@/services/firebase", () => ({
  get: (...args) => mockGet(...args),
  update: (...args) => mockUpdate(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  ref: (_db, path) => path,
}));

vi.mock("./annualLeaveAttendanceSync", () => ({
  persistAnnualLeaveMonthFromAttendance: vi.fn(async () => ({
    appliedCount: 3,
  })),
}));

vi.mock("./attendanceLeaveScope", () => ({
  loadAttendanceDaySnapshot: vi.fn(async () => ({
    emp_A: { mnv: "A" },
    emp_B: { mnv: "B" },
  })),
}));

describe("annual leave daily rollover date", () => {
  it("yesterday of 2026-09-22 is 2026-09-21", () => {
    expect(getDateKeyBySubtractDays("2026-09-22", 1)).toBe("2026-09-21");
  });

  it("yesterday of 2027-01-01 is previous year", () => {
    expect(getDateKeyBySubtractDays("2027-01-01", 1)).toBe("2026-12-31");
  });
});

describe("resolveAnnualLeaveDailySyncClaim", () => {
  const today = "2026-10-02";
  const now = Date.parse("2026-10-02T08:00:00.000Z");

  it("claims when lock is empty", () => {
    const decision = resolveAnnualLeaveDailySyncClaim(null, today, now, "a@x");
    expect(decision.action).toBe("claim");
    expect(decision.next.inProgressDateKey).toBe(today);
    expect(decision.next.inProgressBy).toBe("a@x");
  });

  it("skips when another client already finished today", () => {
    expect(
      resolveAnnualLeaveDailySyncClaim(
        { lastAttendanceSyncDateKey: today },
        today,
        now,
      ),
    ).toEqual({ action: "skip", reason: "already_synced" });
  });

  it("skips when another client holds a fresh claim", () => {
    expect(
      resolveAnnualLeaveDailySyncClaim(
        {
          inProgressDateKey: today,
          inProgressAt: new Date(now - 1000).toISOString(),
        },
        today,
        now,
      ),
    ).toEqual({ action: "skip", reason: "in_progress" });
  });

  it("reclaims after stale in-progress", () => {
    const decision = resolveAnnualLeaveDailySyncClaim(
      {
        inProgressDateKey: today,
        inProgressAt: new Date(
          now - ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS - 1,
        ).toISOString(),
      },
      today,
      now,
      "b@x",
    );
    expect(decision.action).toBe("claim");
    expect(decision.next.inProgressBy).toBe("b@x");
  });
});

describe("syncAnnualLeaveForLocalDayRollover concurrency", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockRunTransaction.mockReset();
  });

  it("second client does not persist when claim aborts", async () => {
    mockGet.mockResolvedValue({
      exists: () => true,
      val: () => ({}),
    });
    mockRunTransaction.mockResolvedValue({ committed: false });

    const result = await syncAnnualLeaveForLocalDayRollover(
      {},
      { todayKey: "2026-10-02", updatedBy: "b@x" },
    );

    const { persistAnnualLeaveMonthFromAttendance } = await import(
      "./annualLeaveAttendanceSync"
    );
    expect(result).toMatchObject({ skipped: true, reason: "not_claimed" });
    expect(persistAnnualLeaveMonthFromAttendance).not.toHaveBeenCalled();
  });

  it("winner persists without touching year _meta", async () => {
    const { persistAnnualLeaveMonthFromAttendance } = await import(
      "./annualLeaveAttendanceSync"
    );
    persistAnnualLeaveMonthFromAttendance.mockClear();
    persistAnnualLeaveMonthFromAttendance.mockResolvedValue({
      appliedCount: 3,
    });

    mockGet.mockResolvedValue({
      exists: () => true,
      val: () => ({}),
    });
    mockRunTransaction.mockImplementation(async (_path, mutator) => {
      const next = mutator(null);
      return { committed: true, snapshot: { val: () => next } };
    });
    mockUpdate.mockResolvedValue();

    const onHeavyWorkStart = vi.fn();
    const result = await syncAnnualLeaveForLocalDayRollover(
      {},
      { todayKey: "2026-10-02", updatedBy: "a@x", onHeavyWorkStart },
    );

    expect(result).toMatchObject({ skipped: false, appliedCount: 3 });
    expect(onHeavyWorkStart).toHaveBeenCalledTimes(1);
    expect(persistAnnualLeaveMonthFromAttendance).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        touchYearMeta: false,
        resyncAggFromMonth: false,
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      annualLeaveDailySyncLockPath(2026),
      expect.objectContaining({ lastAttendanceSyncDateKey: "2026-10-02" }),
    );
  });
});
