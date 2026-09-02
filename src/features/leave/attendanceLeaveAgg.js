import { get, ref, runTransaction, set } from "@/services/firebase";
import { isAttendanceDayMetaKey } from "@/features/attendance/attendanceDayMeta";
import {
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
  attendanceMnvKeyFromDayRecord,
  buildAttendanceAnnualLeaveDerivedMaps,
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
} from "./annualLeaveBalanceLookup";
import { serializeAnnualLeaveUsageDetailForLeaveAgg } from "./annualLeaveStoredUsageDetail";
import { roundAnnualLeaveHours } from "./annualLeaveCalculated";
import { annualLeaveEmpFirebaseKey } from "./annualLeaveEmpKey";
import {
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
} from "./annualLeaveFields";
import {
  ATTENDANCE_LEAVE_AGG_EMP,
  ATTENDANCE_LEAVE_AGG_ROOT,
} from "./attendanceLeaveAggFields";

export function attendanceLeaveAggYearPath(year) {
  return `${ATTENDANCE_LEAVE_AGG_ROOT}/${year}`;
}

export function attendanceLeaveAggEmpPath(year, empKey) {
  return `${attendanceLeaveAggYearPath(year)}/${empKey}`;
}

/** `"01"` … `"12"` từ `yyyy-mm-dd`. */
export function monthKeyFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string" || dateKey.length < 7) return null;
  return dateKey.slice(5, 7);
}

function isLeaveAggMetaKey(key) {
  return key === "_meta";
}

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

function leaveAggMonthMapToMonthlyArray(monthMap) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthKey = String(index + 1).padStart(2, "0");
    return roundAnnualLeaveHours(Number(monthMap?.[monthKey] ?? 0));
  });
}

function monthCountsTowardAnnualLeaveDeduction(year, monthKey) {
  const probeDateKey = `${year}-${monthKey}-15`;
  return isAttendanceDateCountedForAnnualLeave(probeDateKey, year);
}

function sumCountedLeaveAggMonths(monthMap, year) {
  let total = 0;
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const monthKey = String(monthIndex + 1).padStart(2, "0");
    const value = roundAnnualLeaveHours(Number(monthMap?.[monthKey] ?? 0));
    if (value === 0) continue;
    if (!monthCountsTowardAnnualLeaveDeduction(year, monthKey)) continue;
    total += value;
  }
  return roundAnnualLeaveHours(total);
}

/**
 * Chuyển snapshot `attendanceLeaveAgg/{year}` → maps dùng cho persist phép năm.
 * @returns {{ deductionsByEmpKey: Record<string, number>, attendanceMonthlyByEmpKey: Record<string, number[]> }}
 */
export function buildDerivedMapsFromLeaveAggYear(yearAggData, year) {
  const deductionsByEmpKey = {};
  const attendanceMonthlyByEmpKey = {};

  if (!yearAggData || typeof yearAggData !== "object") {
    return { deductionsByEmpKey, attendanceMonthlyByEmpKey };
  }

  for (const [empKey, raw] of Object.entries(yearAggData)) {
    if (isLeaveAggMetaKey(empKey) || !raw || typeof raw !== "object") continue;

    const monthMap = normalizeLeaveAggMonthMap(
      raw[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
    );
    if (!Object.keys(monthMap).length) continue;

    attendanceMonthlyByEmpKey[empKey] = leaveAggMonthMapToMonthlyArray(monthMap);
    const countedTotal = sumCountedLeaveAggMonths(monthMap, year);
    if (countedTotal > 0) {
      deductionsByEmpKey[empKey] = countedTotal;
    }
  }

  return { deductionsByEmpKey, attendanceMonthlyByEmpKey };
}

export function computeDayLeaveDeductionForRecord(dateKey, year, _empKey, rawEmp) {
  if (!rawEmp || typeof rawEmp !== "object") return 0;
  if (!dateKey?.startsWith(`${year}-`)) return 0;

  const counted = isAttendanceDateCountedForAnnualLeave(dateKey, year);
  const displayOnly = isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year);
  if (!counted && !displayOnly) return 0;

  const deduction = attendanceAnnualLeaveDeductionForLoaiPhep(
    attendanceEffectiveLoaiPhepFromRaw(rawEmp),
  );
  return deduction === 0 ? 0 : roundAnnualLeaveHours(deduction);
}

/** Map `emp_{mnv}` → tổng trừ phép trong một ngày điểm danh. */
export function computeDayLeaveDeductionsByEmpKey(dateKey, year, dayData) {
  const map = {};
  if (!dayData || typeof dayData !== "object") return map;

  for (const [recordKey, rawEmp] of Object.entries(dayData)) {
    if (isAttendanceDayMetaKey(recordKey)) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;

    const mnvKey = attendanceMnvKeyFromDayRecord(recordKey, rawEmp);
    const firebaseKey = annualLeaveEmpFirebaseKey(mnvKey);
    if (!firebaseKey) continue;

    const deduction = computeDayLeaveDeductionForRecord(
      dateKey,
      year,
      recordKey,
      rawEmp,
    );
    if (deduction === 0) continue;
    map[firebaseKey] = roundAnnualLeaveHours((map[firebaseKey] ?? 0) + deduction);
  }

  return map;
}

/** Delta theo NV khi thay snapshot một ngày điểm danh. */
export function computeLeaveAggDeltasForDayChange(
  dateKey,
  year,
  previousDayData,
  nextDayData,
) {
  const prev = computeDayLeaveDeductionsByEmpKey(dateKey, year, previousDayData);
  const next = computeDayLeaveDeductionsByEmpKey(dateKey, year, nextDayData);
  const empKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const deltas = [];

  for (const empKey of empKeys) {
    const delta = roundAnnualLeaveHours((next[empKey] ?? 0) - (prev[empKey] ?? 0));
    if (delta !== 0) {
      deltas.push({ empKey, delta });
    }
  }

  return deltas;
}

function buildLeaveAggEmpNode(monthMap, updatedBy = "", usageDetail = null) {
  const deductionByMonth = normalizeLeaveAggMonthMap(monthMap);
  if (!Object.keys(deductionByMonth).length && !usageDetail) return null;

  const node = {
    [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: deductionByMonth,
    [ATTENDANCE_LEAVE_AGG_EMP.LAST_UPDATED]: new Date().toISOString(),
    ...(updatedBy ? { [ATTENDANCE_LEAVE_AGG_EMP.UPDATED_BY]: updatedBy } : {}),
  };

  const serializedDetail = serializeAnnualLeaveUsageDetailForLeaveAgg(usageDetail);
  if (serializedDetail) {
    node[ATTENDANCE_LEAVE_AGG_EMP.USAGE_DETAIL] = serializedDetail;
  }

  return node;
}

/**
 * Cộng dồn delta vào `deductionByMonth[mm]` — atomic qua runTransaction.
 */
export async function applyLeaveAggDeductionDeltaTransaction(
  db,
  { year, empKey, dateKey, delta, updatedBy = "" },
) {
  const resolvedEmpKey = String(empKey ?? "").trim();
  const resolvedDateKey = String(dateKey ?? "").trim();
  const numericDelta = roundAnnualLeaveHours(Number(delta ?? 0));

  if (!resolvedEmpKey || !resolvedDateKey || numericDelta === 0) {
    return { applied: false, reason: "noop" };
  }

  const monthKey = monthKeyFromDateKey(resolvedDateKey);
  if (!monthKey) return { applied: false, reason: "invalid_date" };

  const path = attendanceLeaveAggEmpPath(year, resolvedEmpKey);
  const result = await runTransaction(ref(db, path), (current) => {
    const monthMap = normalizeLeaveAggMonthMap(
      current?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
    );
    const nextValue = roundAnnualLeaveHours(
      (monthMap[monthKey] ?? 0) + numericDelta,
    );

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

export async function applyLeaveAggDeltasForDayChange(
  db,
  { year, dateKey, previousDayData, nextDayData, updatedBy = "" },
) {
  const deltas = computeLeaveAggDeltasForDayChange(
    dateKey,
    year,
    previousDayData,
    nextDayData,
  );

  for (const { empKey, delta } of deltas) {
    await applyLeaveAggDeductionDeltaTransaction(db, {
      year,
      empKey,
      dateKey,
      delta,
      updatedBy,
    });
  }

  return { applied: deltas.length > 0, deltaCount: deltas.length };
}

/** Quét attendance một lần — ghi đè `attendanceLeaveAgg/{year}`. */
export async function rebuildLeaveAggYearFromAttendance(
  db,
  { year, attendanceRootData, updatedBy = "" },
) {
  const { attendanceMonthlyByEmpKey } = buildAttendanceAnnualLeaveDerivedMaps(
    attendanceRootData,
    year,
  );
  const usageDetailByEmpKey = buildAttendanceAnnualLeaveUsageDetailByEmpKey(
    attendanceRootData,
    year,
  );

  const payload = {};
  for (const [empKey, monthRow] of Object.entries(attendanceMonthlyByEmpKey)) {
    const monthMap = {};
    monthRow.forEach((value, index) => {
      const rounded = roundAnnualLeaveHours(Number(value ?? 0));
      if (rounded === 0) return;
      monthMap[String(index + 1).padStart(2, "0")] = rounded;
    });

    const node = buildLeaveAggEmpNode(
      monthMap,
      updatedBy,
      usageDetailByEmpKey[empKey] ?? null,
    );
    if (node) payload[empKey] = node;
  }

  await set(ref(db, attendanceLeaveAggYearPath(year)), payload);
  return { employeeCount: Object.keys(payload).length };
}

/**
 * Ghi đè slice một tháng trên aggregate từ quét attendance tháng đó (backfill / reconcile).
 */
export async function syncLeaveAggMonthSliceFromAttendance(
  db,
  { year, yearMonth, monthAttendanceData, updatedBy = "" },
) {
  if (!monthAttendanceData || typeof monthAttendanceData !== "object") {
    return { employeeCount: 0 };
  }

  const monthKey = String(yearMonth ?? "").slice(5, 7);
  if (!/^(0[1-9]|1[0-2])$/.test(monthKey)) {
    return { employeeCount: 0 };
  }

  const { attendanceMonthlyByEmpKey } = buildAttendanceAnnualLeaveDerivedMaps(
    monthAttendanceData,
    year,
    { yearMonthPrefix: yearMonth },
  );

  let employeeCount = 0;
  for (const [empKey, monthRow] of Object.entries(attendanceMonthlyByEmpKey)) {
    const monthIndex = Number(monthKey) - 1;
    const monthValue = roundAnnualLeaveHours(Number(monthRow?.[monthIndex] ?? 0));
    const path = attendanceLeaveAggEmpPath(year, empKey);

    await runTransaction(ref(db, path), (current) => {
      const monthMap = normalizeLeaveAggMonthMap(
        current?.[ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH],
      );
      if (monthValue === 0) {
        delete monthMap[monthKey];
      } else {
        monthMap[monthKey] = monthValue;
      }
      return buildLeaveAggEmpNode(monthMap, updatedBy);
    });
    employeeCount += 1;
  }

  return { employeeCount };
}

export async function loadLeaveAggYearData(db, year) {
  const snap = await get(ref(db, attendanceLeaveAggYearPath(year)));
  return snap.val();
}

export function leaveAggYearHasEmployeeData(yearAggData) {
  if (!yearAggData || typeof yearAggData !== "object") return false;
  return Object.keys(yearAggData).some(
    (key) =>
      !isLeaveAggMetaKey(key) &&
      yearAggData[key] &&
      typeof yearAggData[key] === "object",
  );
}

/**
 * Đọc aggregate; nếu trống thì backfill một lần từ attendance (full scan).
 */
export async function loadDerivedMapsFromLeaveAgg(
  db,
  year,
  { attendanceRootData = null, rebuildIfMissing = true } = {},
) {
  let yearAggData = await loadLeaveAggYearData(db, year);

  if (
    rebuildIfMissing &&
    !leaveAggYearHasEmployeeData(yearAggData) &&
    attendanceRootData &&
    typeof attendanceRootData === "object"
  ) {
    await rebuildLeaveAggYearFromAttendance(db, { year, attendanceRootData });
    yearAggData = await loadLeaveAggYearData(db, year);
  }

  return {
    yearAggData,
    ...buildDerivedMapsFromLeaveAggYear(yearAggData, year),
  };
}
