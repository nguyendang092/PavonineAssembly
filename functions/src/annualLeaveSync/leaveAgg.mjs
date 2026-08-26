import {
  ANNUAL_LEAVE_EMP,
  ATTENDANCE_LEAVE_AGG_EMP,
  ATTENDANCE_LEAVE_AGG_ROOT,
} from "./fields.mjs";
import { monthKeyFromDateKey, roundAnnualLeaveHours } from "./deduction.mjs";

function normalizeLeaveAggMonthMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object") return {};
  const out = {};
  for (const [monthKey, value] of Object.entries(rawMap)) {
    if (!/^(0[1-9]|1[0-2])$/.test(monthKey)) continue;
    const rounded = roundAnnualLeaveHours(Number(value ?? 0));
    if (rounded === 0) continue;
    out[monthKey] = rounded;
  }
  return out;
}

function buildLeaveAggEmpNode(monthMap, updatedBy = "cloud-function") {
  const deductionByMonth = normalizeLeaveAggMonthMap(monthMap);
  if (!Object.keys(deductionByMonth).length) return null;

  return {
    [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: deductionByMonth,
    [ATTENDANCE_LEAVE_AGG_EMP.LAST_UPDATED]: new Date().toISOString(),
    [ATTENDANCE_LEAVE_AGG_EMP.UPDATED_BY]: updatedBy,
  };
}

export function leaveAggMonthMapToMonthlyArray(monthMap) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthKey = String(index + 1).padStart(2, "0");
    return roundAnnualLeaveHours(Number(monthMap?.[monthKey] ?? 0));
  });
}

/** Atomic += delta vào `attendanceLeaveAgg/{year}/{empKey}`. */
export async function applyLeaveAggDeductionDelta(db, {
  year,
  empKey,
  dateKey,
  delta,
  updatedBy = "cloud-function",
}) {
  const numericDelta = roundAnnualLeaveHours(Number(delta ?? 0));
  const monthKey = monthKeyFromDateKey(dateKey);
  if (!empKey || !monthKey || numericDelta === 0) {
    return { applied: false, reason: "noop" };
  }

  const ref = db.ref(`${ATTENDANCE_LEAVE_AGG_ROOT}/${year}/${empKey}`);
  const result = await ref.transaction((current) => {
    const monthMap = normalizeLeaveAggMonthMap(
      current?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
    );
    const nextValue = roundAnnualLeaveHours((monthMap[monthKey] ?? 0) + numericDelta);
    if (nextValue === 0) {
      delete monthMap[monthKey];
    } else {
      monthMap[monthKey] = nextValue;
    }
    return buildLeaveAggEmpNode(monthMap, updatedBy);
  });

  return {
    applied: true,
    committed: result.committed,
    delta: numericDelta,
    monthKey,
  };
}

export async function loadLeaveAggEmpNode(db, year, empKey) {
  const snap = await db
    .ref(`${ATTENDANCE_LEAVE_AGG_ROOT}/${year}/${empKey}`)
    .get();
  return snap.val();
}

export function buildMonthlyRowFromLeaveAggNode(aggNode) {
  const monthMap = normalizeLeaveAggMonthMap(
    aggNode?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
  );
  return leaveAggMonthMapToMonthlyArray(monthMap);
}

export { ANNUAL_LEAVE_EMP };
