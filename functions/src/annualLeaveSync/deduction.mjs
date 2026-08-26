import {
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
} from "./fields.mjs";

const LOAI_PHEP_PN = "Phép năm";
const LOAI_PHEP_HALF = "1/2 Phép năm";

const LOAI_PHEP_ALIASES = new Map([
  ["pn", LOAI_PHEP_PN],
  ["phep nam", LOAI_PHEP_PN],
  ["phép năm", LOAI_PHEP_PN],
  ["1/2 pn", LOAI_PHEP_HALF],
  ["1/2pn", LOAI_PHEP_HALF],
  ["1/2 phép năm", LOAI_PHEP_HALF],
  ["nua phep nam", LOAI_PHEP_HALF],
]);

function canonicalLoaiPhep(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (LOAI_PHEP_ALIASES.has(lower)) return LOAI_PHEP_ALIASES.get(lower);
  if (text === LOAI_PHEP_PN || text === LOAI_PHEP_HALF) return text;
  return text;
}

/** Loại phép từ node điểm danh (loaiPhep, phepNam, chamCong…). */
export function attendanceEffectiveLoaiPhepFromRaw(raw) {
  if (!raw || typeof raw !== "object") return "";
  const candidates = [raw.loaiPhep, raw.phepNam, raw.chamCong];
  for (const value of candidates) {
    const canon = canonicalLoaiPhep(value);
    if (canon) return canon;
  }
  return "";
}

/** PN −1, 1/2PN −0.5. */
export function attendanceAnnualLeaveDeductionForLoaiPhep(loaiPhep) {
  const canon = canonicalLoaiPhep(loaiPhep);
  if (canon === LOAI_PHEP_PN) return 1;
  if (canon === LOAI_PHEP_HALF) return 0.5;
  return 0;
}

export function roundAnnualLeaveHours(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100 + 1e-9) / 100;
}

export function computeLoaiPhepDeductionDelta(beforeRecord, afterRecord) {
  const oldDed = attendanceAnnualLeaveDeductionForLoaiPhep(
    beforeRecord ? attendanceEffectiveLoaiPhepFromRaw(beforeRecord) : "",
  );
  const newDed = attendanceAnnualLeaveDeductionForLoaiPhep(
    afterRecord ? attendanceEffectiveLoaiPhepFromRaw(afterRecord) : "",
  );
  return roundAnnualLeaveHours(newDed - oldDed);
}

export function monthKeyFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string" || dateKey.length < 7) return null;
  return dateKey.slice(5, 7);
}

export function shouldProcessAttendanceDateForLeave(dateKey, year) {
  return (
    isAttendanceDateCountedForAnnualLeave(dateKey, year) ||
    isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year)
  );
}
