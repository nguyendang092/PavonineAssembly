import {
  MOLD_SHOT_CRITICAL_RATIO,
  MOLD_SHOT_REFERENCE_MAX,
  MOLD_SHOT_WARN_RATIO,
  MOLD_STATUS,
  MOLD_STATUS_VALUES,
} from "./moldConstants";

export function parseShotCount(mold) {
  const raw = mold?.["Shot Counter"];
  const num = parseInt(String(raw ?? "").replace(/,/g, ""), 10);
  return Number.isNaN(num) ? 0 : num;
}

export function resolveStoredMoldStatus(mold) {
  const raw = String(mold?.Status ?? "")
    .trim()
    .toLowerCase();
  return MOLD_STATUS_VALUES.has(raw) ? raw : null;
}

export function inferMoldStatus(mold) {
  const location = String(mold?.Location ?? "").toLowerCase();
  const notes = String(mold?.Notes ?? "").toLowerCase();
  const combined = `${location} ${notes}`;

  if (
    /ngưng|ngung|stop|idle|kho|warehouse|scrap|huỷ|huy|disabled/.test(
      combined,
    )
  ) {
    return MOLD_STATUS.STOPPED;
  }

  const shots = parseShotCount(mold);
  if (shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_CRITICAL_RATIO) {
    return MOLD_STATUS.MAINTENANCE;
  }
  if (shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_WARN_RATIO) {
    return MOLD_STATUS.MAINTENANCE;
  }

  return MOLD_STATUS.ACTIVE;
}

export function getMoldStatus(mold) {
  return resolveStoredMoldStatus(mold) ?? inferMoldStatus(mold);
}

/** Gợi ý điều kiện hiển thị cạnh badge trạng thái */
export function getMoldStatusHint(mold) {
  if (resolveStoredMoldStatus(mold)) {
    return { key: "statusHintManual" };
  }

  const status = inferMoldStatus(mold);
  const shots = parseShotCount(mold);
  const location = String(mold?.Location ?? "").toLowerCase();
  const notes = String(mold?.Notes ?? "").toLowerCase();
  const combined = `${location} ${notes}`;

  if (status === MOLD_STATUS.STOPPED) {
    return { key: "statusHintStopped" };
  }

  if (shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_CRITICAL_RATIO) {
    return {
      key: "statusHintShotCritical",
      pct: Math.round(MOLD_SHOT_CRITICAL_RATIO * 100),
    };
  }

  if (shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_WARN_RATIO) {
    return {
      key: "statusHintShotWarn",
      pct: Math.round(MOLD_SHOT_WARN_RATIO * 100),
    };
  }

  if (/ngưng|ngung|stop|idle|kho|warehouse|scrap|huỷ|huy|disabled/.test(combined)) {
    return { key: "statusHintStopped" };
  }

  return { key: "statusHintActive" };
}

export function getShotProgress(shots) {
  if (!shots) return 0;
  return Math.min(100, (shots / MOLD_SHOT_REFERENCE_MAX) * 100);
}

export function isShotNearMaintenance(shots) {
  return shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_WARN_RATIO;
}

export function buildMoldKpiSummary(molds) {
  const total = molds.length;
  let inUse = 0;
  let maintenance = 0;
  let overThreshold = 0;
  let totalShots = 0;

  molds.forEach((mold) => {
    const status = getMoldStatus(mold);
    const shots = parseShotCount(mold);
    totalShots += shots;

    if (status === MOLD_STATUS.STOPPED) return;
    inUse += 1;
    if (status === MOLD_STATUS.MAINTENANCE) {
      maintenance += 1;
      if (shots >= MOLD_SHOT_REFERENCE_MAX * MOLD_SHOT_CRITICAL_RATIO) {
        overThreshold += 1;
      }
    }
  });

  const utilizationPct = total > 0 ? Math.round((inUse / total) * 100) : 0;

  return {
    total,
    inUse,
    maintenance,
    overThreshold,
    totalShots,
    utilizationPct,
  };
}

export function countByField(molds, field) {
  const counts = {};
  molds.forEach((m) => {
    const key = String(m[field] ?? "").trim();
    if (!key) return;
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

export function resolveTypeStyle(type) {
  const normalized = String(type ?? "").trim().toUpperCase();
  if (normalized === "SMALL PRESS") return "small-press";
  if (normalized === "PRESS") return "press";
  if (normalized === "MOLD") return "mold";
  return "default";
}

export function getShotMaintenanceDisplay(
  shots,
  threshold = 600_000,
) {
  const safeShots = Number(shots) || 0;
  const pct =
    threshold > 0
      ? Math.min(100, Math.round((safeShots / threshold) * 100))
      : 0;
  return { shots: safeShots, threshold, pct };
}
