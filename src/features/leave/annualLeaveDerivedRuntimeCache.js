const EMPTY_DERIVED = Object.freeze({
  deductionsByEmpKey: {},
  attendanceMonthlyByEmpKey: {},
});

/** @type {{ root: object | null, filterKey: string, result: typeof EMPTY_DERIVED }} */
let derivedMapsCache = {
  root: null,
  filterKey: "",
  result: EMPTY_DERIVED,
};

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
  scopeEmpKeySet = null,
} = {}) {
  return [
    throughDateKey ?? "",
    yearMonthPrefix ?? "",
    scopeEmpKeySetToCacheKey(scopeEmpKeySet),
  ].join(":");
}

export function getCachedAttendanceDerivedMaps(
  attendanceRoot,
  filterKey,
  compute,
) {
  if (
    attendanceRoot &&
    derivedMapsCache.root === attendanceRoot &&
    derivedMapsCache.filterKey === filterKey
  ) {
    return derivedMapsCache.result;
  }

  const result = compute();
  if (attendanceRoot) {
    derivedMapsCache = { root: attendanceRoot, filterKey, result };
  }
  return result;
}

export function buildMonthWorkSummaryBucketKey(year, asOfDateKey) {
  return `${year}:${asOfDateKey ?? "full"}`;
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

function pickScopedMonthWorkSummaries(bucket, scopeEmpKeySet) {
  if (!(scopeEmpKeySet instanceof Set) || scopeEmpKeySet.size === 0) {
    return bucket;
  }
  const scoped = {};
  for (const empKey of scopeEmpKeySet) {
    if (bucket[empKey]) scoped[empKey] = bucket[empKey];
  }
  return scoped;
}

export function clearAnnualLeaveDerivedRuntimeCache() {
  derivedMapsCache = { root: null, filterKey: "", result: EMPTY_DERIVED };
  monthWorkSummaryBuckets.clear();
}
