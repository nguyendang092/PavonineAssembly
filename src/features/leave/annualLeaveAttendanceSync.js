import { get, ref, update } from "@/services/firebase";
import {
  buildAttendanceAnnualLeaveDeductionsByMnv,
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
} from "./annualLeaveBalanceLookup";
import { computeLiveAnnualLeaveState } from "./annualLeaveDerived";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import { parseAnnualLeaveNumber } from "./annualLeaveCalculated";

/** Chuyển bản ghi legacy sang khóa `emp_{mnv}` trên Firebase. */
export async function migrateAnnualLeaveYearToEmpKeys(db, year, yearData) {
  if (!yearData || typeof yearData !== "object") return false;

  const updates = {};
  const basePath = `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;

  for (const [recordId, raw] of Object.entries(yearData)) {
    if (recordId === ANNUAL_LEAVE_META_KEY || !raw || typeof raw !== "object") {
      continue;
    }

    const empKey = resolveAnnualLeaveEmpFirebaseKey({ recordId, raw });
    if (!empKey || empKey === recordId) continue;

    updates[`${basePath}/${empKey}`] = { ...raw, id: empKey };
    updates[`${basePath}/${recordId}`] = null;
  }

  if (!Object.keys(updates).length) return false;
  await update(ref(db), updates);
  return true;
}

function needsPersistUpdate(raw, state) {
  const prevUsed = parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]);
  const prevAttendance = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
  );
  const prevHr = parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]);
  const prevBalance = parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.BALANCE]);

  return (
    state.used !== prevUsed ||
    state.attendanceUsed !== prevAttendance ||
    state.hrUsed !== prevHr ||
    state.balance !== prevBalance ||
    raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] == null
  );
}

async function touchAnnualLeaveYearMeta(db, year, updatedBy = "") {
  const metaRef = ref(
    db,
    `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${ANNUAL_LEAVE_META_KEY}`,
  );
  const snap = await get(metaRef);
  if (!snap.exists()) return;
  await update(metaRef, {
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  });
}

/**
 * Ghi `annualLeave/{year}/emp_{mnv}` từ quét điểm danh + phép HR.
 */
export async function persistAnnualLeaveYearFromAttendance(
  db,
  {
    year,
    attendanceRootPath = "attendance",
    updatedBy = "",
    attendanceRootOverride = null,
  },
) {
  let attendanceRootData = attendanceRootOverride;
  if (attendanceRootData == null) {
    const rootSnap = await get(ref(db, attendanceRootPath));
    attendanceRootData = rootSnap.val();
  }

  const deductionsByEmpKey = buildAttendanceAnnualLeaveDeductionsByMnv(
    attendanceRootData,
    year,
  );

  let yearSnap = await get(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`));
  let yearData = yearSnap.val();

  if (yearData && typeof yearData === "object") {
    const migrated = await migrateAnnualLeaveYearToEmpKeys(db, year, yearData);
    if (migrated) {
      yearSnap = await get(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`));
      yearData = yearSnap.val();
    }
  }

  if (!yearData || typeof yearData !== "object") {
    return { results: [], appliedCount: 0 };
  }

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const results = [];
  let anyApplied = false;

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const liveAttendanceUsed = deductionsByEmpKey[empKey] ?? 0;
    const state = computeLiveAnnualLeaveState(raw, liveAttendanceUsed);

    if (!needsPersistUpdate(raw, state)) continue;

    await update(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`), {
      id: empKey,
      [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: state.hrUsed,
      [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: state.attendanceUsed,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
      [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
      [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
    });

    anyApplied = true;
    results.push({
      recordId: empKey,
      empKey,
      hrUsed: state.hrUsed,
      attendanceUsed: state.attendanceUsed,
      newUsed: state.used,
      balance: state.balance,
    });
  }

  if (anyApplied) {
    await touchAnnualLeaveYearMeta(db, year, updatedBy);
  }

  return { results, appliedCount: results.length };
}

function annualLeaveDeductionDelta(oldLoaiPhep, newLoaiPhep) {
  return (
    attendanceAnnualLeaveDeductionForLoaiPhep(newLoaiPhep) -
    attendanceAnnualLeaveDeductionForLoaiPhep(oldLoaiPhep)
  );
}

/** Sau khi điểm danh đổi loại phép — ghi lại cả năm theo `emp_{mnv}`. */
export async function applyAnnualLeaveDeductionDelta(
  db,
  {
    year,
    attendanceRootPath = "attendance",
    updatedBy = "",
    oldRecord = null,
    newRecord = null,
    oldLoaiPhep = "",
    newLoaiPhep = "",
  },
) {
  const oldLp = oldRecord
    ? attendanceEffectiveLoaiPhepFromRaw(oldRecord)
    : String(oldLoaiPhep ?? "").trim();
  const newLp = newRecord
    ? attendanceEffectiveLoaiPhepFromRaw(newRecord)
    : String(newLoaiPhep ?? "").trim();
  const delta = annualLeaveDeductionDelta(oldLp, newLp);
  if (delta === 0) return { applied: false, reason: "no_delta", delta: 0 };

  const { appliedCount } = await persistAnnualLeaveYearFromAttendance(db, {
    year,
    attendanceRootPath,
    updatedBy,
  });

  return {
    applied: appliedCount > 0,
    reason: appliedCount > 0 ? undefined : "no_change",
    delta,
  };
}
