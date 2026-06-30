/**
 * Khung mốc TC sớm (có giấy) — ca ngày và ca đêm S2.
 * Logic tính giờ nằm trong `attendanceWorkingHours.js` (làm tròn 0,1h).
 */

/** Ca ngày: điều kiện popup / giấy — vào ≤ 06:40. */
export const DAY_EARLY_PAPERWORK_CUTOFF_MIN = 6 * 60 + 40;

/** Mốc khung 05:40–06:40 và 06:40–07:40. */
export const DAY_EARLY_OT_MARKER_FIRST_MIN = 5 * 60 + 40;
export const DAY_EARLY_OT_MARKER_SECOND_MIN = 6 * 60 + 40;
/** Từ 06:00 → chỉ khung 06:40–07:40; trước 06:00 → cả hai khung (2h). */
export const DAY_EARLY_OT_SECOND_TIER_MIN = 6 * 60;

export const DAY_EARLY_OT_SEGMENT_EARLY = Object.freeze([
  DAY_EARLY_OT_MARKER_FIRST_MIN,
  DAY_EARLY_OT_MARKER_SECOND_MIN,
]);
export const DAY_EARLY_OT_SEGMENT_LATE = Object.freeze([
  DAY_EARLY_OT_MARKER_SECOND_MIN,
  7 * 60 + 40,
]);
export const DAY_EARLY_OT_MAX_HOURS = 2;

/** Ca đêm S2: GC bắt đầu 19:40 → 05:00 (tối đa 8h). */
export const NIGHT_SHIFT_EARLY_OT_GC_START_MIN = 19 * 60 + 40;
/** Popup giấy TC sớm — vào ≤ 18:40 (khung TC cuối 18:40–19:40). */
export const NIGHT_SHIFT_OFFICIAL_START_MIN = 18 * 60 + 40;
/** Ca đêm: popup giấy — vào từ 15:00 đến ≤ 18:40. */
export const NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN = 15 * 60;

/** Hai khung TC sớm: 17:40–18:40 và 18:40–19:40 (tối đa 2h). */
export const NIGHT_EARLY_OT_SEGMENT_START_MINUTES = Object.freeze([
  17 * 60 + 40,
  18 * 60 + 40,
]);
/** Từ 18:00 → chỉ khung 18:40–19:40; trước 18:00 → cả hai khung (2h). */
export const NIGHT_EARLY_OT_SECOND_TIER_MIN = 18 * 60;
export const NIGHT_EARLY_OT_MAX_HOURS = 2;

/** @deprecated alias — mốc khung đầu (17:40). */
export const NIGHT_EARLY_OT_MARKER_FIRST_MIN =
  NIGHT_EARLY_OT_SEGMENT_START_MINUTES[0];
/** @deprecated alias — mốc khung thứ hai (18:40). */
export const NIGHT_EARLY_OT_MARKER_SECOND_MIN =
  NIGHT_EARLY_OT_SEGMENT_START_MINUTES[1];
/** @deprecated alias — tier 18:00. */
export const NIGHT_EARLY_OT_TIER_START_MINUTES = Object.freeze([
  NIGHT_EARLY_OT_SECOND_TIER_MIN,
]);

/** Ca đêm: hai khung TC sớm (mỗi khung 1h), tối đa 2h. */
export const NIGHT_EARLY_OT_SEGMENTS = Object.freeze(
  NIGHT_EARLY_OT_SEGMENT_START_MINUTES.map((start, i) =>
    Object.freeze([
      start,
      i < NIGHT_EARLY_OT_SEGMENT_START_MINUTES.length - 1
        ? NIGHT_EARLY_OT_SEGMENT_START_MINUTES[i + 1]
        : NIGHT_SHIFT_EARLY_OT_GC_START_MIN,
    ]),
  ),
);

/**
 * Phút TC trong khung [segStart, segEnd] — bắt đầu từ max(giờ vào, segStart).
 * @param {number} entryMin
 * @param {number} segStart
 * @param {number} segEnd
 */
export function paperworkOvertimeSegmentMinutes(entryMin, segStart, segEnd) {
  const start = Math.max(entryMin, segStart);
  if (start >= segEnd) return 0;
  return segEnd - start;
}

/** Tổng phút TC qua nhiều khung mốc. */
export function sumPaperworkOvertimeSegmentMinutes(entryMin, segments) {
  let total = 0;
  for (const [segStart, segEnd] of segments) {
    total += paperworkOvertimeSegmentMinutes(entryMin, segStart, segEnd);
  }
  return total;
}

/**
 * Ca ngày TC sớm theo giờ vào — luôn tính từ **mốc** (không trừ phút chấm sớm trong khung):
 * - Trước 06:00 (gồm 05:40–05:59) → 05:40–06:40 + 06:40–07:40 (2h)
 * - Từ 06:00 đến ≤06:40 → 06:40–07:40 (1h)
 * @param {number} entryMin — phút từ 0:00
 */
export function dayEarlyPaperworkOvertimeMinutes(entryMin) {
  const earlyLen =
    DAY_EARLY_OT_SEGMENT_EARLY[1] - DAY_EARLY_OT_SEGMENT_EARLY[0];
  const lateLen = DAY_EARLY_OT_SEGMENT_LATE[1] - DAY_EARLY_OT_SEGMENT_LATE[0];

  if (entryMin < DAY_EARLY_OT_SECOND_TIER_MIN) {
    return earlyLen + lateLen;
  }
  if (entryMin <= DAY_EARLY_PAPERWORK_CUTOFF_MIN) {
    return lateLen;
  }
  return 0;
}

/**
 * Ca đêm TC sớm theo giờ vào — luôn tính từ **mốc** (không trừ phút chấm sớm trong khung):
 * - Trước 18:00 → 17:40–18:40 + 18:40–19:40 (2h)
 * - Từ 18:00 đến ≤18:40 → 18:40–19:40 (1h)
 * @param {number} entryMin — phút từ 0:00
 */
export function nightEarlyPaperworkOvertimeMinutes(entryMin) {
  const earlyLen =
    NIGHT_EARLY_OT_SEGMENT_START_MINUTES[1] -
    NIGHT_EARLY_OT_SEGMENT_START_MINUTES[0];
  const lateLen =
    NIGHT_SHIFT_EARLY_OT_GC_START_MIN -
    NIGHT_EARLY_OT_SEGMENT_START_MINUTES[1];

  if (entryMin < NIGHT_EARLY_OT_SECOND_TIER_MIN) {
    return earlyLen + lateLen;
  }
  if (entryMin <= NIGHT_SHIFT_OFFICIAL_START_MIN) {
    return lateLen;
  }
  return 0;
}
