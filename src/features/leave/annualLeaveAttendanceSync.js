import { get, ref, update } from "@/services/firebase";
import {
  buildAttendanceAnnualLeaveDerivedMaps,
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
} from "./annualLeaveBalanceLookup";
import {
  computeLiveAnnualLeaveState,
  resolveEffectiveMonthlyLeaveUsage,
  resolveStoredMonthlyLeaveUsage,
  sumAnnualLeaveMonthlyUsageValues,
} from "./annualLeaveDerived";
import { buildAnnualLeaveMonthWorkSummaryByEmpKey } from "./annualLeavePayrollAccrual";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_RTDB_ROOT,
} from "./annualLeaveFields";
import {
  normalizeAnnualLeaveStartWorkingDate,
  parseAnnualLeaveNumber,
  parseAnnualLeaveAdjustment,
  resolveAnnualLeaveYearAsOfDateKey,
} from "./annualLeaveCalculated";
import { queueSingleEmployeeAnnualLeavePersist } from "./annualLeavePersistQueue";

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
  const prevUsed = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED],
  );
  const prevAttendance = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
  );
  const prevHr = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED],
  );
  const prevBalance = parseAnnualLeaveNumber(raw[ANNUAL_LEAVE_EMP.BALANCE]);
  const prevCurrentYear = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
  );
  const prevTotal = parseAnnualLeaveNumber(
    raw[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
  );
  const normalizedStart = normalizeAnnualLeaveStartWorkingDate(
    raw[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
  );
  const prevStart = String(raw[ANNUAL_LEAVE_EMP.START_WORKING_DATE] ?? "").trim();

  return (
    state.used !== prevUsed ||
    state.attendanceUsed !== prevAttendance ||
    state.hrUsed !== prevHr ||
    state.balance !== prevBalance ||
    state.annualLeaveCurrentYear !== prevCurrentYear ||
    state.totalAnnualLeave !== prevTotal ||
    (normalizedStart && normalizedStart !== prevStart) ||
    raw[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED] == null
  );
}

function buildAnnualLeavePersistPayload(empKey, raw, state) {
  const normalizedStart = normalizeAnnualLeaveStartWorkingDate(
    raw[ANNUAL_LEAVE_EMP.START_WORKING_DATE],
  );
  const prevStart = String(raw[ANNUAL_LEAVE_EMP.START_WORKING_DATE] ?? "").trim();

  return {
    id: empKey,
    ...(normalizedStart && normalizedStart !== prevStart
      ? { [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: normalizedStart }
      : {}),
    [ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED]: state.hrUsed,
    [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: state.attendanceUsed,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: state.used,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: state.annualLeaveCurrentYear,
    [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: state.totalAnnualLeave,
    [ANNUAL_LEAVE_EMP.BALANCE]: state.balance,
  };
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

  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    buildAttendanceAnnualLeaveDerivedMaps(attendanceRootData, year);

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
  const monthWorkSummaryByEmpKey = buildAnnualLeaveMonthWorkSummaryByEmpKey(
    attendanceRootData,
    year,
    yearData,
    { attendanceRootPath },
  );
  const results = [];
  let anyApplied = false;

  for (const [empKey, { raw }] of Object.entries(indexed)) {
    const state = computePersistStateForRaw(raw, empKey, year, {
      deductionsByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
    });

    if (!needsPersistUpdate(raw, state)) continue;

    await update(
      ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`),
      buildAnnualLeavePersistPayload(empKey, raw, state),
    );

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

/**
 * Cập nhật phép năm một NV sau điểm danh — tránh quét + ghi toàn bộ năm.
 */
export async function persistSingleEmployeeAnnualLeaveFromAttendance(
  db,
  {
    year,
    empKey,
    attendanceRootPath = "attendance",
    updatedBy = "",
    attendanceRootOverride = null,
  },
) {
  const resolvedEmpKey = String(empKey ?? "").trim();
  if (!resolvedEmpKey) {
    return { applied: false, reason: "no_emp_key" };
  }

  let attendanceRootData = attendanceRootOverride;
  if (attendanceRootData == null) {
    const rootSnap = await get(ref(db, attendanceRootPath));
    attendanceRootData = rootSnap.val();
  }

  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    buildAttendanceAnnualLeaveDerivedMaps(attendanceRootData, year);

  const yearSnap = await get(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`));
  const yearData = yearSnap.val();
  if (!yearData || typeof yearData !== "object") {
    return { applied: false, reason: "no_year" };
  }

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const entry = indexed[resolvedEmpKey];
  if (!entry?.raw) {
    return { applied: false, reason: "no_record" };
  }

  const scopeEmpKeySet = new Set([resolvedEmpKey]);
  const monthWorkSummaryByEmpKey = buildAnnualLeaveMonthWorkSummaryByEmpKey(
    attendanceRootData,
    year,
    yearData,
    { attendanceRootPath, scopeEmpKeySet },
  );

  const state = computePersistStateForRaw(entry.raw, resolvedEmpKey, year, {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
  });

  if (!needsPersistUpdate(entry.raw, state)) {
    return { applied: false, reason: "no_change" };
  }

  await update(
    ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${resolvedEmpKey}`),
    buildAnnualLeavePersistPayload(resolvedEmpKey, entry.raw, state),
  );

  await touchAnnualLeaveYearMeta(db, year, updatedBy);
  return { applied: true, state };
}

function computePersistStateForRaw(
  raw,
  empKey,
  year,
  {
    deductionsByEmpKey = {},
    attendanceMonthlyByEmpKey = {},
    monthWorkSummaryByEmpKey = {},
  },
) {
  const storedMonthly = resolveStoredMonthlyLeaveUsage(raw);
  const monthValues = resolveEffectiveMonthlyLeaveUsage(
    raw,
    null,
    year,
    attendanceMonthlyByEmpKey[empKey],
  );
  const monthlySum = sumAnnualLeaveMonthlyUsageValues(monthValues);
  const hasStored = storedMonthly != null;
  const hasAttendanceMonthly = attendanceMonthlyByEmpKey[empKey] != null;
  const usedFromMonthlySum =
    hasStored || hasAttendanceMonthly ? monthlySum : null;
  const liveAttendanceUsed =
    usedFromMonthlySum ?? deductionsByEmpKey[empKey] ?? 0;
  return computeLiveAnnualLeaveState(raw, liveAttendanceUsed, year, {
    usedFromMonthlySum,
    monthWorkSummaryByYearMonth: monthWorkSummaryByEmpKey[empKey] ?? null,
    asOfDateKey: resolveAnnualLeaveYearAsOfDateKey(year),
  });
}

/**
 * Lưu điều chỉnh phép năm + tính lại và ghi đầy đủ used/total/balance lên Firebase.
 */
export async function persistAnnualLeaveEmployeeAdjustment(
  db,
  {
    year,
    empKey,
    raw,
    adjustment,
    deductionsByEmpKey = {},
    attendanceMonthlyByEmpKey = {},
    monthWorkSummaryByEmpKey = {},
    updatedBy = "",
  },
) {
  if (!empKey || !raw || typeof raw !== "object") {
    return { applied: false };
  }

  const parsedAdj = parseAnnualLeaveAdjustment(adjustment);
  const updatedRaw = {
    ...raw,
    id: empKey,
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]:
      parsedAdj === 0 ? null : parsedAdj,
  };
  const state = computePersistStateForRaw(updatedRaw, empKey, year, {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
  });

  await update(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`), {
    ...buildAnnualLeavePersistPayload(empKey, updatedRaw, state),
    [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]:
      parsedAdj === 0 ? null : parsedAdj,
  });

  await touchAnnualLeaveYearMeta(db, year, updatedBy);
  return { applied: true, state };
}

function annualLeaveDeductionDelta(oldLoaiPhep, newLoaiPhep) {
  return (
    attendanceAnnualLeaveDeductionForLoaiPhep(newLoaiPhep) -
    attendanceAnnualLeaveDeductionForLoaiPhep(oldLoaiPhep)
  );
}

/** Sau khi điểm danh đổi loại phép — ghi lại phép năm của NV liên quan. */
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

  const sourceRecord = oldRecord ?? newRecord;
  const empKey = resolveAnnualLeaveEmpFirebaseKey({
    recordId: sourceRecord?.id,
    raw: sourceRecord,
    mnv: sourceRecord?.mnv,
  });

  if (empKey) {
    queueSingleEmployeeAnnualLeavePersist(db, {
      year,
      empKey,
      attendanceRootPath,
      updatedBy,
    });
    return {
      applied: true,
      reason: "queued",
      delta,
    };
  }

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
