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

/** Ca đêm S2: mốc GC / TC sớm 18:40; có giấy → GC từ 19:40. */
export const NIGHT_SHIFT_OFFICIAL_START_MIN = 18 * 60 + 40;
export const NIGHT_SHIFT_EARLY_OT_GC_START_MIN = 19 * 60 + 40;
/** Ca đêm: popup giấy — vào từ 15:00 đến ≤ 18:40 (trước 15:40 vẫn đủ 4 khung TC). */
export const NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN = 15 * 60;

/** Bắt đầu 4 khung mốc TC sớm: 15:40 → 16:40 → 17:40 → 18:40 → 19:40 (GC). */
export const NIGHT_EARLY_OT_SEGMENT_START_MINUTES = Object.freeze([
  15 * 60 + 40,
  16 * 60 + 40,
  17 * 60 + 40,
  18 * 60 + 40,
]);
/** Tier 16:00 / 17:00 / 18:00 — song song pattern ca ngày (06:00 / 07:00). */
export const NIGHT_EARLY_OT_TIER_START_MINUTES = Object.freeze([
  16 * 60,
  17 * 60,
  18 * 60,
]);
export const NIGHT_EARLY_OT_MAX_HOURS = 4;

/** @deprecated alias — mốc khung đầu (15:40). */
export const NIGHT_EARLY_OT_MARKER_FIRST_MIN =
  NIGHT_EARLY_OT_SEGMENT_START_MINUTES[0];
/** @deprecated alias — mốc khung thứ hai (16:40). */
export const NIGHT_EARLY_OT_MARKER_SECOND_MIN =
  NIGHT_EARLY_OT_SEGMENT_START_MINUTES[1];
/** @deprecated alias — tier đầu (16:00). */
export const NIGHT_EARLY_OT_SECOND_TIER_MIN =
  NIGHT_EARLY_OT_TIER_START_MINUTES[0];

/** Ca đêm: bốn khung TC sớm (mỗi khung 1h), tối đa 4h. */
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
 * Khung: 15:40–16:40, 16:40–17:40, 17:40–18:40, 18:40–19:40 (tối đa 4h).
 * Tier (giống ca ngày): trước mốc đầu → 4h; tại mốc → 1 khung; từ :00 → bỏ các khung trước.
 * @param {number} entryMin — phút từ 0:00
 */
export function nightEarlyPaperworkOvertimeMinutes(entryMin) {
  const starts = NIGHT_EARLY_OT_SEGMENT_START_MINUTES;
  const tiers = NIGHT_EARLY_OT_TIER_START_MINUTES;
  const n = starts.length;
  const oneHour = 60;

  if (entryMin < starts[0]) {
    return n * oneHour;
  }

  for (let i = 0; i < n - 1; i++) {
    if (entryMin < tiers[i]) {
      return oneHour;
    }
    if (entryMin < starts[i + 1]) {
      return (n - i - 1) * oneHour;
    }
  }

  if (entryMin <= NIGHT_SHIFT_OFFICIAL_START_MIN) {
    return oneHour;
  }
  return 0;
}
