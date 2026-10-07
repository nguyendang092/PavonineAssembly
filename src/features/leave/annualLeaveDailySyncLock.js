import { ref, runTransaction, update } from "@/services/firebase";

export const ANNUAL_LEAVE_DAILY_SYNC_ROOT = "annualLeaveDailySync";

export const ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS = 4 * 60 * 1000;

export function annualLeaveDailySyncLockPath(year) {
  return `${ANNUAL_LEAVE_DAILY_SYNC_ROOT}/${year}`;
}

export function isAnnualLeaveDailySyncLockActive(lock, nowMs = Date.now()) {
  if (!lock || typeof lock !== "object") return false;
  const inProgressDate = String(lock.inProgressDateKey ?? "");
  if (!inProgressDate) return false;
  const inProgressAt = Date.parse(lock.inProgressAt ?? "");
  if (!Number.isFinite(inProgressAt)) return false;
  return nowMs - inProgressAt < ANNUAL_LEAVE_DAILY_SYNC_CLAIM_STALE_MS;
}

/**
 * N client cùng claim: chỉ 1 người `claim`, mọi người còn lại `skip`.
 * @returns {{ action: "claim", next: object } | { action: "skip", reason: string }}
 */
export function resolveAnnualLeaveDailySyncClaim(
  current,
  todayKey,
  nowMs,
  updatedBy = "",
) {
  const today = String(todayKey);
  if (String(current?.lastAttendanceSyncDateKey ?? "") === today) {
    return { action: "skip", reason: "already_synced" };
  }

  if (isAnnualLeaveDailySyncLockActive(current, nowMs)) {
    return { action: "skip", reason: "in_progress" };
  }

  return {
    action: "claim",
    next: {
      ...(current && typeof current === "object" ? current : {}),
      inProgressDateKey: today,
      inProgressAt: new Date(nowMs).toISOString(),
      ...(updatedBy ? { inProgressBy: updatedBy } : {}),
    },
  };
}

export async function claimAnnualLeaveDailySync(
  db,
  year,
  todayKey,
  updatedBy = "",
) {
  const lockRef = ref(db, annualLeaveDailySyncLockPath(year));
  const tx = await runTransaction(lockRef, (current) => {
    const decision = resolveAnnualLeaveDailySyncClaim(
      current,
      todayKey,
      Date.now(),
      updatedBy,
    );
    if (decision.action !== "claim") return undefined;
    return decision.next;
  });

  if (!tx.committed) {
    return { claimed: false, reason: "not_claimed" };
  }
  return { claimed: true };
}

export async function completeAnnualLeaveDailySync(
  db,
  year,
  todayKey,
  updatedBy = "",
) {
  await update(ref(db, annualLeaveDailySyncLockPath(year)), {
    lastAttendanceSyncDateKey: todayKey,
    lastAttendanceSyncAt: new Date().toISOString(),
    inProgressDateKey: null,
    inProgressAt: null,
    inProgressBy: null,
    ...(updatedBy ? { updatedBy } : {}),
  });
}

export async function releaseAnnualLeaveDailySyncClaim(db, year) {
  await update(ref(db, annualLeaveDailySyncLockPath(year)), {
    inProgressDateKey: null,
    inProgressAt: null,
    inProgressBy: null,
  });
}
