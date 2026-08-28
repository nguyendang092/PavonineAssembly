import { buildAttendanceAnnualLeaveDerivedMaps } from "./annualLeaveBalanceLookup";
import {
  annualLeaveDeductionDayFingerprint,
  diffAttendanceYearSnapshots,
  intersectScopeEmpKeys,
} from "./annualLeaveAttendanceDiff";
import { buildAnnualLeaveMonthWorkSummaryForEmpKey } from "./annualLeavePayrollAccrual";

const EMPTY_DERIVED = Object.freeze({
  deductionsByEmpKey: {},
  attendanceMonthlyByEmpKey: {},
});

const EMPTY_MONTH = Object.freeze(Array.from({ length: 12 }, () => 0));

/** @type {Map<string, Map<string, { deductions: number, attendanceMonthly: number[] }>>} */
const empDerivedBuckets = new Map();

/** @type {Map<string, Map<string, string>>} */
const dayFingerprintStores = new Map();

/** @type {Map<string, object | null>} */
const lastAttendanceRoots = new Map();

/** @type {Map<string, Record<string, object>>} */
const monthWorkSummaryBuckets = new Map();

export function scopeEmpKeySetToCacheKey(scopeEmpKeySet) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    return "all";
  }
  return [...scopeEmpKeySet].sort().join("|");
}

export function buildDerivedMapsFilterKey({
  throughDateKey = null,
  yearMonthPrefix = null,
} = {}) {
  return [throughDateKey ?? "", yearMonthPrefix ?? ""].join(":");
}

/** empKey nào đã có derived cache trong bucket (tránh flash pending khi đổi trang/bộ phận). */
export function listEmpDerivedBucketCacheHits(filterKey, scopeEmpKeySet) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    return [];
  }
  const bucket = empDerivedBuckets.get(filterKey);
  if (!bucket) return [];
  const hits = [];
  for (const empKey of scopeEmpKeySet) {
    if (bucket.has(empKey)) hits.push(empKey);
  }
  return hits;
}

function getEmpDerivedBucket(filterKey) {
  let bucket = empDerivedBuckets.get(filterKey);
  if (!bucket) {
    bucket = new Map();
    empDerivedBuckets.set(filterKey, bucket);
  }
  return bucket;
}

function getDayFingerprintStore(attendanceScopeKey) {
  let store = dayFingerprintStores.get(attendanceScopeKey);
  if (!store) {
    store = new Map();
    dayFingerprintStores.set(attendanceScopeKey, store);
  }
  return store;
}

function computeEmpDerivedEntry(attendanceRoot, year, deductionFilter, empKey) {
  const partial = buildAttendanceAnnualLeaveDerivedMaps(
    attendanceRoot,
    year,
    deductionFilter,
    empKey,
  );
  return {
    deductions: partial.deductionsByEmpKey[empKey] ?? 0,
    attendanceMonthly: partial.attendanceMonthlyByEmpKey[empKey] ?? EMPTY_MONTH,
  };
}

function recomputeEmpKeysInBucket(
  bucket,
  attendanceRoot,
  year,
  deductionFilter,
  empKeys,
) {
  for (const empKey of empKeys) {
    if (!empKey) continue;
    bucket.set(
      empKey,
      computeEmpDerivedEntry(attendanceRoot, year, deductionFilter, empKey),
    );
  }
}

function updateDayFingerprints(attendanceScopeKey, attendanceRoot, year) {
  const store = getDayFingerprintStore(attendanceScopeKey);
  const yearPrefix = `${year}-`;
  const nextKeys = new Set();

  if (attendanceRoot && typeof attendanceRoot === "object") {
    for (const [dateKey, dayData] of Object.entries(attendanceRoot)) {
      if (!dateKey.startsWith(yearPrefix)) continue;
      nextKeys.add(dateKey);
      store.set(dateKey, annualLeaveDeductionDayFingerprint(dayData));
    }
  }

  for (const dateKey of store.keys()) {
    if (!nextKeys.has(dateKey)) store.delete(dateKey);
  }

  return store;
}

function assembleDerivedMapsFromBucket(
  bucket,
  scopeEmpKeySet,
  prevMaps = null,
) {
  const prevDeductions = prevMaps?.deductionsByEmpKey ?? {};
  const prevMonthly = prevMaps?.attendanceMonthlyByEmpKey ?? {};
  const deductionsByEmpKey = { ...prevDeductions };
  const attendanceMonthlyByEmpKey = { ...prevMonthly };

  const keys =
    scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0
      ? scopeEmpKeySet
      : bucket.keys();

  for (const empKey of keys) {
    const entry = bucket.get(empKey);
    if (!entry) {
      delete deductionsByEmpKey[empKey];
      delete attendanceMonthlyByEmpKey[empKey];
      continue;
    }
    deductionsByEmpKey[empKey] = entry.deductions;
    attendanceMonthlyByEmpKey[empKey] = entry.attendanceMonthly;
  }

  return { deductionsByEmpKey, attendanceMonthlyByEmpKey };
}

/**
 * Đồng bộ derived maps — diff theo ngày, chỉ tính lại empKey bị ảnh hưởng (+ cache miss trong scope).
 * @returns {{ maps: typeof EMPTY_DERIVED, recomputedEmpKeys: Set<string>, isInitial: boolean }}
 */
export function syncAttendanceDerivedMaps({
  attendanceRoot,
  year,
  filterKey,
  deductionFilter,
  scopeEmpKeySet = null,
  attendanceScopeKey,
  prevMaps = null,
  forceFullScope = false,
}) {
  if (!attendanceRoot || !year) {
    return {
      maps: EMPTY_DERIVED,
      recomputedEmpKeys: new Set(),
      isInitial: false,
    };
  }

  const bucket = getEmpDerivedBucket(filterKey);
  const fingerprintStore = getDayFingerprintStore(attendanceScopeKey);
  const prevRoot = lastAttendanceRoots.get(attendanceScopeKey) ?? null;

  const { changedDateKeys, affectedEmpKeys, isInitial } =
    diffAttendanceYearSnapshots(
      prevRoot,
      attendanceRoot,
      year,
      fingerprintStore,
    );

  lastAttendanceRoots.set(attendanceScopeKey, attendanceRoot);
  updateDayFingerprints(attendanceScopeKey, attendanceRoot, year);

  const recomputedEmpKeys = new Set();
  let keysToCompute = new Set();

  if (forceFullScope || isInitial) {
    if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
      keysToCompute = new Set(scopeEmpKeySet);
    } else if (isInitial) {
      keysToCompute = new Set(affectedEmpKeys);
    }
  } else if (changedDateKeys.size > 0) {
    keysToCompute = intersectScopeEmpKeys(affectedEmpKeys, scopeEmpKeySet);
  }

  if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
    for (const empKey of scopeEmpKeySet) {
      if (!bucket.has(empKey)) keysToCompute.add(empKey);
    }
  }

  if (keysToCompute.size > 0) {
    recomputeEmpKeysInBucket(
      bucket,
      attendanceRoot,
      year,
      deductionFilter,
      keysToCompute,
    );
    for (const empKey of keysToCompute) recomputedEmpKeys.add(empKey);
  }

  const maps = assembleDerivedMapsFromBucket(bucket, scopeEmpKeySet, prevMaps);

  return { maps, recomputedEmpKeys, isInitial };
}

export function buildMonthWorkSummaryBucketKey(year, asOfDateKey) {
  return `${year}:${asOfDateKey ?? "full"}`;
}

function getMonthWorkBucket(bucketKey) {
  let bucket = monthWorkSummaryBuckets.get(bucketKey);
  if (!bucket) {
    bucket = {};
    monthWorkSummaryBuckets.set(bucketKey, bucket);
  }
  return bucket;
}

export function syncMonthWorkSummaryMaps({
  attendanceRoot,
  year,
  yearData,
  bucketKey,
  attendanceRootPath = "attendance",
  scopeEmpKeySet = null,
  changedDateKeys = null,
  affectedEmpKeys = null,
  prevScopedMaps = null,
  forceEmpKeys = null,
}) {
  if (!attendanceRoot || !yearData) {
    return pickScopedMonthWorkSummaries({}, scopeEmpKeySet);
  }

  const bucket = getMonthWorkBucket(bucketKey);
  const keysToCompute = new Set(forceEmpKeys ?? []);

  if (affectedEmpKeys?.size) {
    for (const empKey of intersectScopeEmpKeys(
      affectedEmpKeys,
      scopeEmpKeySet,
    )) {
      keysToCompute.add(empKey);
    }
  }

  if (scopeEmpKeySet instanceof Set && scopeEmpKeySet.size > 0) {
    for (const empKey of scopeEmpKeySet) {
      if (!bucket[empKey]) keysToCompute.add(empKey);
    }
  }

  for (const empKey of keysToCompute) {
    if (!empKey) continue;
    const summary = buildAnnualLeaveMonthWorkSummaryForEmpKey(
      attendanceRoot,
      year,
      yearData,
      empKey,
      { attendanceRootPath },
    );
    if (summary && Object.keys(summary).length) {
      bucket[empKey] = summary;
    } else {
      delete bucket[empKey];
    }
  }

  return pickScopedMonthWorkSummaries(bucket, scopeEmpKeySet, prevScopedMaps);
}

export function mergeMonthWorkSummaryCache(
  bucketKey,
  nextByEmpKey,
  scopeEmpKeySet = null,
) {
  if (!nextByEmpKey || typeof nextByEmpKey !== "object") {
    return pickScopedMonthWorkSummaries(
      monthWorkSummaryBuckets.get(bucketKey) ?? {},
      scopeEmpKeySet,
    );
  }

  const bucket = { ...(monthWorkSummaryBuckets.get(bucketKey) ?? {}) };
  for (const [empKey, summary] of Object.entries(nextByEmpKey)) {
    if (empKey) bucket[empKey] = summary;
  }
  monthWorkSummaryBuckets.set(bucketKey, bucket);
  return pickScopedMonthWorkSummaries(bucket, scopeEmpKeySet);
}

function pickScopedMonthWorkSummaries(
  bucket,
  scopeEmpKeySet,
  prevScopedMaps = null,
) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    return bucket;
  }
  const scoped = { ...(prevScopedMaps ?? {}) };
  for (const empKey of scopeEmpKeySet) {
    if (bucket[empKey]) scoped[empKey] = bucket[empKey];
    else delete scoped[empKey];
  }
  return scoped;
}

export function clearAnnualLeaveDerivedRuntimeCache() {
  empDerivedBuckets.clear();
  dayFingerprintStores.clear();
  lastAttendanceRoots.clear();
  monthWorkSummaryBuckets.clear();
}
