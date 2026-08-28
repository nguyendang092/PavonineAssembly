import { endAt, get, query, orderByKey, ref, runTransaction, startAt, update } from "@/services/firebase";
import {
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
} from "./annualLeaveBalanceLookup";
import {
  applyLeaveAggDeductionDeltaTransaction,
  applyLeaveAggDeltasForDayChange,
  buildDerivedMapsFromLeaveAggYear,
  leaveAggYearHasEmployeeData,
  loadLeaveAggYearData,
  rebuildLeaveAggYearFromAttendance,
  syncLeaveAggMonthSliceFromAttendance,
} from "./attendanceLeaveAgg";
import {
  loadAttendanceRootForYearMonth,
  resolveYearMonthFromDateKey,
} from "./attendanceLeaveScope";
import {
  computeLiveAnnualLeaveState,
  resolveEffectiveMonthlyLeaveUsage,
  resolveStoredMonthlyLeaveUsage,
  sumAnnualLeaveMonthlyUsageValues,
} from "./annualLeaveDerived";
import {
  listAnnualLeaveAccrualYearMonths,
  resolveAccrualYearMonthsAttendanceRange,
} from "./annualLeavePayrollAccrual";
import {
  getCachedAnnualLeaveMonthWorkSummaryByEmpKey,
  invalidateAnnualLeaveMonthWorkSummaryPersistCache,
} from "./annualLeaveMonthWorkSummaryPersistCache";
import {
  indexAnnualLeaveYearByEmpKey,
  resolveAnnualLeaveEmpFirebaseKey,
} from "./annualLeaveEmpKey";
import {
  buildAttendanceProfileByEmpKey,
  resolveAnnualLeaveRawWithProfiles,
} from "./annualLeaveRawProfile";
import {
  ANNUAL_LEAVE_EMP,
  ANNUAL_LEAVE_META_KEY,
  ANNUAL_LEAVE_META_MIGRATED,
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

  const meta = yearData[ANNUAL_LEAVE_META_KEY];
  if (meta?.[ANNUAL_LEAVE_META_MIGRATED] === true) return false;

  const updates = {};
  const basePath = `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`;
  const metaPath = `${basePath}/${ANNUAL_LEAVE_META_KEY}`;

  for (const [recordId, raw] of Object.entries(yearData)) {
    if (recordId === ANNUAL_LEAVE_META_KEY || !raw || typeof raw !== "object") {
      continue;
    }

    const empKey = resolveAnnualLeaveEmpFirebaseKey({ recordId, raw });
    if (!empKey || empKey === recordId) continue;

    updates[`${basePath}/${empKey}`] = { ...raw, id: empKey };
    updates[`${basePath}/${recordId}`] = null;
  }

  const hasMeta = meta && typeof meta === "object";
  if (!hasMeta) {
    if (!Object.keys(updates).length) return false;
    await update(ref(db), updates);
    return true;
  }

  if (!Object.keys(updates).length) {
    await update(ref(db, metaPath), {
      [ANNUAL_LEAVE_META_MIGRATED]: true,
    });
    return true;
  }

  await update(ref(db), {
    ...updates,
    [metaPath]: {
      ...meta,
      [ANNUAL_LEAVE_META_MIGRATED]: true,
    },
  });
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

async function loadAttendanceRootData(db, attendanceRootPath) {
  const rootSnap = await get(ref(db, attendanceRootPath));
  return rootSnap.val();
}

/** Chỉ tải các ngày trong khoảng accrual giờ công — tránh get() cả năm. */
async function loadAttendanceRootForAccrual(
  db,
  attendanceRootPath,
  year,
  yearData,
  { scopeEmpKeySet = null } = {},
) {
  const yearMonths = listAnnualLeaveAccrualYearMonths(yearData, year, {
    scopeEmpKeySet,
  });
  const range = resolveAccrualYearMonthsAttendanceRange(yearMonths);
  if (!range) return null;

  const accrualQuery = query(
    ref(db, attendanceRootPath),
    orderByKey(),
    startAt(range.startAt),
    endAt(range.endAt),
  );
  const snap = await get(accrualQuery);
  return snap.val();
}

async function resolvePersistDerivedMaps(
  db,
  year,
  {
    attendanceRootPath = "attendance",
    attendanceRootOverride = null,
    rebuildLeaveAgg = false,
  },
) {
  let attendanceRootData = attendanceRootOverride;

  if (rebuildLeaveAgg && attendanceRootData == null) {
    attendanceRootData = await loadAttendanceRootData(db, attendanceRootPath);
  }

  if (rebuildLeaveAgg && attendanceRootData) {
    await rebuildLeaveAggYearFromAttendance(db, {
      year,
      attendanceRootData,
    });
  }

  let yearAggData = await loadLeaveAggYearData(db, year);
  if (!leaveAggYearHasEmployeeData(yearAggData)) {
    if (attendanceRootData == null) {
      attendanceRootData = await loadAttendanceRootData(db, attendanceRootPath);
    }
    if (attendanceRootData) {
      await rebuildLeaveAggYearFromAttendance(db, {
        year,
        attendanceRootData,
      });
      yearAggData = await loadLeaveAggYearData(db, year);
    }
  }

  return {
    yearAggData,
    ...buildDerivedMapsFromLeaveAggYear(yearAggData, year),
  };
}

async function resolvePersistDerivedMapsForMonth(
  db,
  year,
  yearMonth,
  {
    monthAttendanceData = null,
    updatedBy = "",
    resyncAggFromMonth = false,
  },
) {
  let yearAggData = await loadLeaveAggYearData(db, year);

  const shouldSyncMonthSlice =
    monthAttendanceData &&
    typeof monthAttendanceData === "object" &&
    (resyncAggFromMonth || !leaveAggYearHasEmployeeData(yearAggData));

  if (shouldSyncMonthSlice) {
    await syncLeaveAggMonthSliceFromAttendance(db, {
      year,
      yearMonth,
      monthAttendanceData,
      updatedBy,
    });
    yearAggData = await loadLeaveAggYearData(db, year);
  }

  return {
    yearAggData,
    ...buildDerivedMapsFromLeaveAggYear(yearAggData, year),
  };
}

function resolvePersistScopeEmpKeys(indexed, scopeEmpKeySet) {
  if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
    return [...scopeEmpKeySet].filter((empKey) => indexed[empKey]?.raw);
  }
  return Object.keys(indexed);
}

function buildPersistContextMaps({
  deductionsByEmpKey,
  attendanceMonthlyByEmpKey,
  monthWorkSummaryByEmpKey,
  empKey,
}) {
  return {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey: {
      [empKey]: monthWorkSummaryByEmpKey[empKey] ?? null,
    },
  };
}

function persistStateFromPayload(payload) {
  return {
    hrUsed: parseAnnualLeaveNumber(
      payload?.[ANNUAL_LEAVE_EMP.HR_ANNUAL_LEAVE_USED],
    ),
    attendanceUsed: parseAnnualLeaveNumber(
      payload?.[ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED],
    ),
    used: parseAnnualLeaveNumber(payload?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]),
    balance: parseAnnualLeaveNumber(payload?.[ANNUAL_LEAVE_EMP.BALANCE]),
    totalAnnualLeave: parseAnnualLeaveNumber(
      payload?.[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE],
    ),
    annualLeaveCurrentYear: parseAnnualLeaveNumber(
      payload?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR],
    ),
  };
}

function resolveAnnualLeaveEmployeePersistWrite(
  raw,
  empKey,
  year,
  {
    deductionsByEmpKey = {},
    attendanceMonthlyByEmpKey = {},
    monthWorkSummaryByEmpKey = {},
  },
  { applyRawPatch = null } = {},
) {
  if (!raw || typeof raw !== "object") return null;

  const mergedRaw =
    typeof applyRawPatch === "function" ? applyRawPatch(raw) : raw;
  if (!mergedRaw || typeof mergedRaw !== "object") return null;

  const state = computePersistStateForRaw(
    mergedRaw,
    empKey,
    year,
    buildPersistContextMaps({
      deductionsByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
      empKey,
    }),
  );

  if (!needsPersistUpdate(mergedRaw, state)) return null;

  const payload = buildAnnualLeavePersistPayload(empKey, mergedRaw, state);
  if (typeof applyRawPatch === "function") {
    payload[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT] =
      mergedRaw[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT] ?? null;
  }

  return {
    payload,
    state: {
      hrUsed: state.hrUsed,
      attendanceUsed: state.attendanceUsed,
      used: state.used,
      balance: state.balance,
      totalAnnualLeave: state.totalAnnualLeave,
      annualLeaveCurrentYear: state.annualLeaveCurrentYear,
    },
  };
}

function buildAnnualLeaveBatchPersistUpdates(year, writesByEmpKey) {
  const updates = {};
  for (const [empKey, { payload, raw }] of Object.entries(writesByEmpKey)) {
    if (!empKey || !payload) continue;
    // RTDB update() replaces the whole child node — merge with existing raw
    // (same as runTransaction) so profile / monthlyLeaveUsage are not wiped.
    updates[`${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`] = {
      ...(raw && typeof raw === "object" ? raw : {}),
      ...payload,
    };
  }
  return updates;
}

/**
 * Ghi `annualLeave/{year}/{empKey}` bằng transaction — retry khi conflict, tránh ghi đè.
 */
async function runAnnualLeaveEmployeePersistTransaction(
  db,
  {
    year,
    empKey,
    deductionsByEmpKey = {},
    attendanceMonthlyByEmpKey = {},
    monthWorkSummaryByEmpKey = {},
    applyRawPatch = null,
  },
) {
  const empRef = ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}/${empKey}`);

  const tx = await runTransaction(empRef, (current) => {
    if (!current || typeof current !== "object") return undefined;

    const write = resolveAnnualLeaveEmployeePersistWrite(
      current,
      empKey,
      year,
      {
        deductionsByEmpKey,
        attendanceMonthlyByEmpKey,
        monthWorkSummaryByEmpKey,
      },
      { applyRawPatch },
    );
    if (!write) return undefined;

    return {
      ...current,
      ...write.payload,
    };
  });

  if (!tx.committed) {
    return { applied: false, reason: "no_change" };
  }

  const persisted = tx.snapshot.val();
  return {
    applied: true,
    state: persistStateFromPayload(persisted),
  };
}

async function persistAnnualLeaveForEmployeeKeys(
  db,
  {
    year,
    yearData,
    empKeys,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    attendanceRootPath,
    attendanceRootForAccrual,
    updatedBy = "",
  },
) {
  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const scopeEmpKeySet =
    empKeys instanceof Set ? empKeys : new Set(empKeys ?? []);
  const scopedIndexed =
    scopeEmpKeySet.size > 0
      ? Object.fromEntries(
          [...scopeEmpKeySet]
            .filter((empKey) => indexed[empKey])
            .map((empKey) => [empKey, indexed[empKey]]),
        )
      : indexed;

  const monthWorkSummaryByEmpKey = getCachedAnnualLeaveMonthWorkSummaryByEmpKey(
    attendanceRootForAccrual,
    year,
    yearData,
    {
      attendanceRootPath,
      scopeEmpKeySet: scopeEmpKeySet.size > 0 ? scopeEmpKeySet : null,
    },
  );

  const attendanceProfiles = buildAttendanceProfileByEmpKey(
    attendanceRootForAccrual,
    scopeEmpKeySet.size > 0 ? scopeEmpKeySet : null,
  );

  const results = [];
  const pendingWrites = {};

  for (const [empKey, { raw }] of Object.entries(scopedIndexed)) {
    const enrichedRaw = resolveAnnualLeaveRawWithProfiles(
      raw,
      empKey,
      attendanceProfiles,
    );
    const write = resolveAnnualLeaveEmployeePersistWrite(
      enrichedRaw,
      empKey,
      year,
      {
        deductionsByEmpKey,
        attendanceMonthlyByEmpKey,
        monthWorkSummaryByEmpKey,
      },
    );
    if (!write) continue;
    pendingWrites[empKey] = { ...write, raw: enrichedRaw };
  }

  const changedEmpKeys = Object.keys(pendingWrites);
  if (changedEmpKeys.length === 0) {
    return { results, appliedCount: 0 };
  }

  if (changedEmpKeys.length === 1) {
    const empKey = changedEmpKeys[0];
    const txResult = await runAnnualLeaveEmployeePersistTransaction(db, {
      year,
      empKey,
      deductionsByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
    });

    if (txResult.applied) {
      results.push({
        recordId: empKey,
        empKey,
        hrUsed: txResult.state.hrUsed,
        attendanceUsed: txResult.state.attendanceUsed,
        newUsed: txResult.state.used,
        balance: txResult.state.balance,
      });
      await touchAnnualLeaveYearMeta(db, year, updatedBy);
    }

    return { results, appliedCount: results.length };
  }

  await update(ref(db), buildAnnualLeaveBatchPersistUpdates(year, pendingWrites));

  for (const empKey of changedEmpKeys) {
    const { state } = pendingWrites[empKey];
    results.push({
      recordId: empKey,
      empKey,
      hrUsed: state.hrUsed,
      attendanceUsed: state.attendanceUsed,
      newUsed: state.used,
      balance: state.balance,
    });
  }

  await touchAnnualLeaveYearMeta(db, year, updatedBy);

  return { results, appliedCount: results.length };
}

/**
 * Ghi `annualLeave/{year}/emp_{mnv}` từ aggregate điểm danh + phép HR.
 */
export async function persistAnnualLeaveYearFromAttendance(
  db,
  {
    year,
    attendanceRootPath = "attendance",
    updatedBy = "",
    attendanceRootOverride = null,
    rebuildLeaveAgg = false,
  },
) {
  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    await resolvePersistDerivedMaps(db, year, {
      attendanceRootPath,
      attendanceRootOverride,
      rebuildLeaveAgg,
    });

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
  const attendanceRootForAccrual =
    attendanceRootOverride ??
    (await loadAttendanceRootForAccrual(
      db,
      attendanceRootPath,
      year,
      yearData,
    ));

  return persistAnnualLeaveForEmployeeKeys(db, {
    year,
    yearData,
    empKeys: Object.keys(indexed),
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    attendanceRootPath,
    attendanceRootForAccrual,
    updatedBy,
  });
}

/**
 * Sync phép năm các NV trong phạm vi một tháng — đọc agg + attendance tháng (không cả năm).
 * Dùng sau xóa 1 NV / xóa cả ngày / upload Excel 1 ngày.
 */
export async function persistAnnualLeaveMonthFromAttendance(
  db,
  {
    year,
    yearMonth,
    dateKey = null,
    attendanceRootPath = "attendance",
    updatedBy = "",
    scopeEmpKeySet = null,
    monthAttendanceOverride = null,
  },
) {
  const resolvedYearMonth =
    yearMonth ?? resolveYearMonthFromDateKey(dateKey ?? "");
  if (!resolvedYearMonth) {
    return { results: [], appliedCount: 0, reason: "invalid_year_month" };
  }

  const monthAttendanceData =
    monthAttendanceOverride ??
    (await loadAttendanceRootForYearMonth(
      db,
      attendanceRootPath,
      resolvedYearMonth,
    ));

  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    await resolvePersistDerivedMapsForMonth(db, year, resolvedYearMonth, {
      monthAttendanceData,
      updatedBy,
    });

  const yearSnap = await get(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`));
  let yearData = yearSnap.val();
  if (!yearData || typeof yearData !== "object") {
    return { results: [], appliedCount: 0, reason: "no_year" };
  }

  if (typeof yearData === "object") {
    const migrated = await migrateAnnualLeaveYearToEmpKeys(db, year, yearData);
    if (migrated) {
      const nextSnap = await get(ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`));
      yearData = nextSnap.val();
    }
  }

  const indexed = indexAnnualLeaveYearByEmpKey(yearData);
  const empKeys = resolvePersistScopeEmpKeys(indexed, scopeEmpKeySet);
  if (!empKeys.length) {
    return { results: [], appliedCount: 0, reason: "no_scope" };
  }

  const scopeSet = new Set(empKeys);
  const attendanceRootForAccrual = await loadAttendanceRootForAccrual(
    db,
    attendanceRootPath,
    year,
    yearData,
    { scopeEmpKeySet: scopeSet },
  );

  return persistAnnualLeaveForEmployeeKeys(db, {
    year,
    yearData,
    empKeys: scopeSet,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    attendanceRootPath,
    attendanceRootForAccrual,
    updatedBy,
  });
}

/**
 * Cập nhật phép năm một NV sau điểm danh — đọc aggregate thay vì quét cả năm.
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

  const { deductionsByEmpKey, attendanceMonthlyByEmpKey } =
    await resolvePersistDerivedMaps(db, year, {
      attendanceRootPath,
      attendanceRootOverride,
      rebuildLeaveAgg: false,
    });

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
  const attendanceRootForAccrual =
    attendanceRootOverride ??
    (await loadAttendanceRootForAccrual(
      db,
      attendanceRootPath,
      year,
      yearData,
      { scopeEmpKeySet },
    ));

  const { appliedCount, results } = await persistAnnualLeaveForEmployeeKeys(db, {
    year,
    yearData,
    empKeys: scopeEmpKeySet,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    attendanceRootPath,
    attendanceRootForAccrual,
    updatedBy,
  });

  if (appliedCount === 0) {
    return { applied: false, reason: "no_change" };
  }

  return { applied: true, state: results[0] };
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
    raw: _raw,
    adjustment,
    deductionsByEmpKey = {},
    attendanceMonthlyByEmpKey = {},
    monthWorkSummaryByEmpKey = {},
    updatedBy = "",
  },
) {
  if (!empKey) {
    return { applied: false };
  }

  const parsedAdj = parseAnnualLeaveAdjustment(adjustment);
  const txResult = await runAnnualLeaveEmployeePersistTransaction(db, {
    year,
    empKey,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    applyRawPatch: (current) => ({
      ...current,
      id: empKey,
      [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]:
        parsedAdj === 0 ? null : parsedAdj,
    }),
  });

  if (!txResult.applied) {
    return { applied: false, reason: "no_change" };
  }

  await touchAnnualLeaveYearMeta(db, year, updatedBy);
  return { applied: true, state: txResult.state };
}

function annualLeaveDeductionDelta(oldLoaiPhep, newLoaiPhep) {
  return (
    attendanceAnnualLeaveDeductionForLoaiPhep(newLoaiPhep) -
    attendanceAnnualLeaveDeductionForLoaiPhep(oldLoaiPhep)
  );
}

/** Client fallback khi chưa có Cloud Function — delta 1 ngày → agg → persist 1 NV. */
export async function applyAnnualLeaveDeductionDelta(
  db,
  {
    year,
    attendanceRootPath = "attendance",
    updatedBy = "",
    dateKey = "",
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

  const sourceRecord = oldRecord ?? newRecord;
  const empKey = resolveAnnualLeaveEmpFirebaseKey({
    recordId: sourceRecord?.id,
    raw: sourceRecord,
    mnv: sourceRecord?.mnv,
  });

  if (empKey && year) {
    invalidateAnnualLeaveMonthWorkSummaryPersistCache({
      year,
      attendanceRootPath,
      empKeys: [empKey],
    });
  }

  if (delta === 0) return { applied: false, reason: "no_delta", delta: 0 };

  if (empKey && dateKey) {
    await applyLeaveAggDeductionDeltaTransaction(db, {
      year,
      empKey,
      dateKey,
      delta,
      updatedBy,
    });
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

  if (empKey) {
    const single = await persistSingleEmployeeAnnualLeaveFromAttendance(db, {
      year,
      empKey,
      attendanceRootPath,
      updatedBy,
    });
    return {
      applied: single.applied,
      reason: single.reason,
      delta,
    };
  }

  const yearMonth = resolveYearMonthFromDateKey(dateKey);
  if (yearMonth) {
    const { appliedCount } = await persistAnnualLeaveMonthFromAttendance(db, {
      year,
      yearMonth,
      dateKey,
      attendanceRootPath,
      updatedBy,
    });
    return {
      applied: appliedCount > 0,
      reason: appliedCount > 0 ? undefined : "no_change",
      delta,
    };
  }

  return { applied: false, reason: "no_target", delta };
}

export {
  applyLeaveAggDeltasForDayChange,
  rebuildLeaveAggYearFromAttendance,
  runAnnualLeaveEmployeePersistTransaction,
  invalidateAnnualLeaveMonthWorkSummaryPersistCache,
};
