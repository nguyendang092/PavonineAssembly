/**
 * Khung mốc TC sớm (có giấy) — ca ngày và ca đêm S2.
 * Logic tính giờ nằm trong `attendanceWorkingHours.js` (làm tròn 0,1h).
 */

/** Ca ngày: điều kiện popup / giấy — vào ≤ 06:40. */
export const DAY_EARLY_PAPERWORK_CUTOFF_MIN = 6 * 60 + 40;

/** Vào trước 05:40 → khung 05:40–06:40; từ 05:40 → khung 06:40–07:40 (chỉ một khung). */
export const DAY_EARLY_OT_MARKER_SPLIT_MIN = 5 * 60 + 40;
export const DAY_EARLY_OT_SEGMENT_EARLY = Object.freeze([
  5 * 60 + 40,
  6 * 60 + 40,
]);
export const DAY_EARLY_OT_SEGMENT_LATE = Object.freeze([
  6 * 60 + 40,
  7 * 60 + 40,
]);
export const DAY_EARLY_OT_MAX_HOURS = 1;

/** Ca đêm S2: mốc GC / TC sớm 18:40; có giấy → GC từ 19:40. */
export const NIGHT_SHIFT_OFFICIAL_START_MIN = 18 * 60 + 40;
export const NIGHT_SHIFT_EARLY_OT_GC_START_MIN = 19 * 60 + 40;
/** Ca đêm: popup giấy — vào 17:00–18:40. */
export const NIGHT_SHIFT_EARLY_PAPERWORK_MIN_IN_MIN = 17 * 60;

/** Ca đêm: khung TC sớm 18:40–19:40 (1h). */
export const NIGHT_EARLY_OT_SEGMENTS = Object.freeze([
  Object.freeze([
    NIGHT_SHIFT_OFFICIAL_START_MIN,
    NIGHT_SHIFT_EARLY_OT_GC_START_MIN,
  ]),
]);

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
 * Ca ngày TC sớm: một khung duy nhất theo giờ vào.
 * @param {number} entryMin — phút từ 0:00
 */
export function dayEarlyPaperworkOvertimeMinutes(entryMin) {
  const [segStart, segEnd] =
    entryMin < DAY_EARLY_OT_MARKER_SPLIT_MIN
      ? DAY_EARLY_OT_SEGMENT_EARLY
      : DAY_EARLY_OT_SEGMENT_LATE;
  return paperworkOvertimeSegmentMinutes(entryMin, segStart, segEnd);
}
