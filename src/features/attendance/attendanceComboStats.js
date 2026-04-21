/** Logic cờ thống kê combo (điểm danh) — dùng cho modal Thống kê và bảng chi tiết KPI */

import {
  foldGioVaoCompare,
  ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH,
  rawMatchesAttendanceTypeOption,
  getAttendanceLeaveTypeRaw,
} from "./attendanceGioVaoTypeOptions";

export const normalizeTextValue = (value) => String(value ?? "").trim();

const FUNERAL_FOLD_LABEL = foldGioVaoCompare("Phép tang");
const FUNERAL_FOLD_CODE = foldGioVaoCompare("PT");

/** Khớp Phép tang / PT / FUNERAL trên một chuỗi (giờ vào, chấm công, ghi chú…). */
export function textMatchesFuneralLeave(raw) {
  const t = normalizeTextValue(raw).replace(/\u00a0/g, " ");
  if (!t) return false;
  const folded = foldGioVaoCompare(t);
  if (folded === FUNERAL_FOLD_LABEL || folded === FUNERAL_FOLD_CODE) return true;
  const compact = folded.replace(/\s/g, "");
  if (compact === "PT" || compact === "PHEPTANG") return true;
  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes("PT")) return true;
  if (latin.includes("PHEP TANG") || latin.includes("FUNERAL")) return true;
  if (latin.replace(/\s/g, "").includes("PHEPTANG")) return true;
  return false;
}

const CO_DI_LAM_FOLD_FULL = foldGioVaoCompare("Có đi làm");
const CO_DI_LAM_FOLD_SHORT = foldGioVaoCompare("Có");

/** Khớp «Bù giờ công» / BGC / «Có đi làm» / ghi tắt Có — dùng cột Giờ vào & ghi chú */
export function textMatchesBuGioCong(raw) {
  const t = normalizeTextValue(raw).replace(/\u00a0/g, " ");
  if (!t) return false;
  const folded = foldGioVaoCompare(t);
  if (folded === CO_DI_LAM_FOLD_FULL) return true;
  if (folded === CO_DI_LAM_FOLD_SHORT) return true;
  const compact = folded.replace(/\s/g, "");
  if (compact === "CODILAM" || compact.includes("CODILAM")) return true;
  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes("BGC")) return true;
  if (latin.includes("CO DI LAM")) return true;
  if (latin.replace(/\s/g, "").includes("CODILAM")) return true;
  if (folded === foldGioVaoCompare("Bù giờ công")) return true;
  if (latin.includes("BU GIO CONG")) return true;
  return false;
}

/** Giờ chuẩn HH:MM (hoặc HH:MM:SS), không nhận text loại phép / ngoài 24h */
export const GIO_VAO_HHMM_STRICT = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Cột phép năm / ghi chú: ghi Thai sản / TS / maternity.
 * Dùng cho ẩn cột chuyên cần + loại ngày khỏi mẫu số.
 */
export function isPnTonPhepNamTextMarkedThaiSan(raw) {
  const s = String(raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!s || s === "--") return false;
  if (s.includes("THAI SAN") || s.includes("THAISAN")) return true;
  if (s.includes("MATERNITY")) return true;
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.some((t) => t === "TS")) return true;
  return false;
}

/** Giờ vào (chuỗi tự do): Thai sản / TS / maternity — bỏ dấu, so khớp chặt hơn token PN. */
export function gioVaoTextLooksLikeMaternity(raw) {
  const s = normalizeTextValue(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!s) return false;
  if (s.includes("THAI SAN") || s.includes("THAISAN")) return true;
  if (s.includes("MATERNITY")) return true;
  const compact = s.replace(/\s+/g, "");
  if (compact.includes("THAISAN")) return true;
  const tokens = s.split(/[^A-Z0-9]+/).filter(Boolean);
  if (tokens.includes("TS")) return true;
  return false;
}

/**
 * Một dòng attendance/{ngày}: coi là thai sản → không tính vào chuyên cần (bỏ qua ngày).
 * Gồm giờ vào, cờ combo, cột PN/phepNam/chấm công của đúng ngày đó.
 */
export function isMaternityForDiligenceRow(row) {
  if (!row || typeof row !== "object") return false;
  const flags = getAttendanceComboFlags(row);
  if (flags.maternity) return true;
  if (isPnTonPhepNamTextMarkedThaiSan(row.pnTon ?? row.phepNam))
    return true;
  if (isPnTonPhepNamTextMarkedThaiSan(row.chamCong)) return true;
  return false;
}

/** Cùng logic với thống kê combo chart — dùng cho bảng chi tiết khi bấm KPI */
export function getAttendanceComboFlags(emp) {
  const gioVaoRaw = normalizeTextValue(emp.gioVao);
  const leaveTypeRaw = normalizeTextValue(getAttendanceLeaveTypeRaw(emp));
  const isTimeFormat = /^\d{1,2}:\d{2}(:\d{2})?$/.test(gioVaoRaw);
  const textSignalRaw = leaveTypeRaw || (isTimeFormat ? "" : gioVaoRaw);
  const nonStandardTimeIn =
    gioVaoRaw !== "" && !GIO_VAO_HHMM_STRICT.test(gioVaoRaw);
  // Trường hợp cần theo dõi riêng: không có giờ vào HH:MM nhưng có loại phép.
  const timeInHashHHMM = gioVaoRaw === "" && leaveTypeRaw !== "";
  const gioVaoNormalized = normalizeTextValue(textSignalRaw)
    .replace(/\u00a0/g, " ")
    .toUpperCase();
  const gioVaoLatin = gioVaoNormalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const gioVaoTokens = gioVaoLatin
    .split(/[^A-Z0-9/]+/)
    .flatMap((t) => t.split("/"))
    .filter(Boolean);
  const hasLeaveCode = (...codes) =>
    codes.some((code) => gioVaoTokens.includes(code));
  const hasText = (...texts) => texts.some((txt) => gioVaoLatin.includes(txt));
  const caLamViecNormalized = normalizeTextValue(emp.caLamViec).toLowerCase();
  const isLate = hasLeaveCode("VT") || hasText("VAO TRE");
  /** Tách khỏi PN cả ngày — thống kê Dashboard có ô riêng 1/2PN */
  const halfAnnualHeuristic =
    hasLeaveCode("1/2PN") ||
    hasText("1/2 PHEP NAM", "1/2PHEPNAM", "1/2 PN");
  const hasCheckIn =
    isTimeFormat ||
    hasLeaveCode("BGC") ||
    hasText("CO DI LAM", "DI LAM") ||
    isLate;
  /**
   * NV quên chấm giờ nhưng có mặt — ghi «Bù giờ công» / BGC / «Có đi làm» ở Giờ vào / ghi chú.
   * Tách biệt checkedIn (giờ HH:MM, BGC trong luồng chấm công…).
   */
  const buGioCongMatch =
    textMatchesBuGioCong(textSignalRaw) ||
    textMatchesBuGioCong(emp.chamCong) ||
    textMatchesBuGioCong(emp.phepNam) ||
    textMatchesBuGioCong(emp.pnTon);
  const isAnnualLeave =
    !halfAnnualHeuristic &&
    (hasLeaveCode("PN", "PCT") || hasText("PHEP NAM", "PHEP CONG TAC"));
  const isLaborAccident = hasLeaveCode("TN") || hasText("TNLD", "TAI NAN");
  const isMaternity =
    hasLeaveCode("TS") ||
    hasText("THAI SAN", "THAISAN") ||
    gioVaoTextLooksLikeMaternity(textSignalRaw);
  const isNoPermit = hasLeaveCode("KP") || hasText("KHONG PHEP");
  const isUnpaidLeave = hasLeaveCode("KL") || hasText("KHONG LUONG");
  const isSickLeave = hasLeaveCode("PO") || hasText("PHEP OM", "NGHI OM");
  /** Phép tang: giờ vào + chấm công / PN (ghi chú) — đồng bộ với dropdown & Excel */
  const isFuneralLeave =
    textMatchesFuneralLeave(textSignalRaw) ||
    textMatchesFuneralLeave(emp.chamCong) ||
    textMatchesFuneralLeave(emp.phepNam) ||
    textMatchesFuneralLeave(emp.pnTon);
  const isResignedLeave = hasLeaveCode("NV") || hasText("NGHI VIEC");
  const isNightShift = caLamViecNormalized.replace(/\s+/g, "") === "s2";

  /** Khớp từng loại trong ATTENDANCE_LOAI_PHEP_OPTIONS (cột loại phép / trạng thái) + ghi chú liên quan */
  const scanRaws = [
    textSignalRaw,
    gioVaoRaw,
    normalizeTextValue(emp.chamCong),
    normalizeTextValue(emp.phepNam),
    normalizeTextValue(emp.pnTon),
  ].filter(Boolean);
  const typeHitKeys = new Set();
  for (const raw of scanRaws) {
    for (const opt of ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH) {
      if (rawMatchesAttendanceTypeOption(raw, opt))
        typeHitKeys.add(opt.comboStatKey);
    }
  }

  const weddingLeave =
    typeHitKeys.has("weddingLeave") ||
    hasLeaveCode("PC") ||
    hasText("PHEP CUOI", "PHEPCUOI");
  const recuperationLeave =
    typeHitKeys.has("recuperationLeave") ||
    hasLeaveCode("DS") ||
    hasText("DUONG SUC", "DUONGSUC");

  const halfAnnualLeave =
    halfAnnualHeuristic || typeHitKeys.has("halfAnnualLeave");
  const annualLeave =
    !halfAnnualLeave &&
    (isAnnualLeave || typeHitKeys.has("annualLeave"));

  return {
    nonStandardTimeIn,
    timeInHashHHMM,
    checkedIn: hasCheckIn,
    buGioCong:
      buGioCongMatch ||
      typeHitKeys.has("buGioCong") ||
      typeHitKeys.has("coDiLam"),
    late: isLate || typeHitKeys.has("late"),
    annualLeave,
    halfAnnualLeave,
    nightShift: isNightShift,
    laborAccident:
      isLaborAccident || typeHitKeys.has("laborAccident"),
    maternity: isMaternity || typeHitKeys.has("maternity"),
    weddingLeave,
    noPermit: isNoPermit || typeHitKeys.has("noPermit"),
    unpaidLeave: isUnpaidLeave || typeHitKeys.has("unpaidLeave"),
    sickLeave: isSickLeave || typeHitKeys.has("sickLeave"),
    funeralLeave:
      isFuneralLeave || typeHitKeys.has("funeralLeave"),
    recuperationLeave,
    resignedLeave:
      isResignedLeave || typeHitKeys.has("resignedLeave"),
  };
}
