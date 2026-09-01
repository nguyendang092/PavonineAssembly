import {
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
  ATTENDANCE_LEAVE_AGG_EMP,
  ATTENDANCE_LEAVE_AGG_ROOT,
} from "./fields.mjs";
import { roundAnnualLeaveHours } from "./deduction.mjs";
import { indexAnnualLeaveYearByEmpKey } from "./empKey.mjs";
import { leaveAggMonthMapToMonthlyArray } from "./leaveAgg.mjs";
import {
  buildPersistPayload,
  computePersistStateForRaw,
  needsPersistUpdate,
} from "./persistEmployee.mjs";
import {
  loadAttendanceForYear,
  rebuildLeaveAggYearFromAttendance,
} from "./rebuildLeaveAgg.mjs";

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

function buildMonthlyRowFromAggNode(aggNode) {
  const monthMap = normalizeLeaveAggMonthMap(
    aggNode?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
  );
  return leaveAggMonthMapToMonthlyArray(monthMap);
}

async function touchAnnualLeaveYearMeta(db, year, updatedBy = "") {
  const metaRef = db.ref(
    `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${ANNUAL_LEAVE_META_KEY}`,
  );
  const snap = await metaRef.get();
  if (!snap.exists()) return;
  await metaRef.update({
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "cloud-function",
    lastScheduledRecalculateAt: new Date().toISOString(),
  });
}

/**
 * Ghi `annualLeave/{year}` từ aggregate — batch update (giống nút «Tính lại»).
 */
export async function persistAnnualLeaveYearFromAgg(db, { year, updatedBy = "" }) {
  const [yearSnap, aggSnap] = await Promise.all([
    db.ref(`${ANNUAL_LEAVE_RTDB_ROOT}/${year}`).get(),
    db.ref(`${ATTENDANCE_LEAVE_AGG_ROOT}/${year}`).get(),
  ]);

  const yearData = yearSnap.val();
  const aggYear = aggSnap.val() ?? {};
  if (!yearData || typeof yearData !== "object") {
    return { appliedCount: 0, employeeCount: 0 };
  }

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const updates = {};
  let appliedCount = 0;

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const attendanceMonthly = buildMonthlyRowFromAggNode(aggYear[empKey]);
    const { state, monthValues } = computePersistStateForRaw(
      raw,
      year,
      attendanceMonthly,
    );

    if (!needsPersistUpdate(raw, state, { monthValues })) continue;

    const payload = buildPersistPayload(empKey, raw, state, { monthValues });
    updates[`${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`] = {
      ...raw,
      ...payload,
    };
    appliedCount += 1;
  }

  if (appliedCount > 0) {
    await db.ref().update(updates);
    await touchAnnualLeaveYearMeta(db, year, updatedBy);
  }

  return {
    appliedCount,
    employeeCount: Object.keys(indexed).length,
  };
}

/**
 * Rebuild aggregate + sync phép năm cả năm (tương đương «Tính lại»).
 */
export async function persistAnnualLeaveYearFromAttendance(
  db,
  {
    year,
    attendanceRoot = "attendance",
    updatedBy = "cloud-function",
    rebuildLeaveAgg = true,
    attendanceRootOverride = null,
  },
) {
  const attendanceRootData =
    attendanceRootOverride ??
    (await loadAttendanceForYear(db, year, attendanceRoot));

  if (rebuildLeaveAgg && attendanceRootData) {
    await rebuildLeaveAggYearFromAttendance(db, {
      year,
      attendanceRootData,
      updatedBy,
    });
  }

  return persistAnnualLeaveYearFromAgg(db, { year, updatedBy });
}
