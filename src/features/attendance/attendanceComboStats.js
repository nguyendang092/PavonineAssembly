/** Logic cờ thống kê combo (điểm danh) — dùng cho modal Thống kê và bảng chi tiết KPI */

import {
  foldGioVaoCompare,
  ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH,
  rawMatchesAttendanceTypeOption,
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

/** Khớp loại «Có đi làm» / CDL / ghi tắt Có — dùng cột Giờ vào & ghi chú */
export function textMatchesCoDiLam(raw) {
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
  if (tokens.includes("CDL")) return true;
  if (latin.includes("CO DI LAM")) return true;
  if (latin.replace(/\s/g, "").includes("CODILAM")) return true;
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
  const isTimeFormat = /^\d{1,2}:\d{2}(:\d{2})?$/.test(gioVaoRaw);
  const nonStandardTimeIn =
    gioVaoRaw !== "" && !GIO_VAO_HHMM_STRICT.test(gioVaoRaw);
  const gioVaoNormalized = normalizeTextValue(emp.gioVao)
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
  const hasCheckIn =
    isTimeFormat ||
    hasLeaveCode("CDL") ||
    hasText("CO DI LAM", "DI LAM") ||
    isLate;
  /**
   * NV quên chấm giờ nhưng có mặt — ghi «Có đi làm» (hoặc CDL/Có) ở Giờ vào / ghi chú.
   * Tách biệt checkedIn (giờ HH:MM, CDL trong luồng chấm công…).
   */
  const coDiLam =
    textMatchesCoDiLam(gioVaoRaw) ||
    textMatchesCoDiLam(emp.chamCong) ||
    textMatchesCoDiLam(emp.phepNam) ||
    textMatchesCoDiLam(emp.pnTon);
  const isAnnualLeave =
    hasLeaveCode("PN", "PCT") ||
    hasText("PHEP NAM", "1/2PHEPNAM", "1/2 PN", "PHEP CONG TAC");
  const isLaborAccident = hasLeaveCode("TN") || hasText("TNLD", "TAI NAN");
  const isMaternity =
    hasLeaveCode("TS") ||
    hasText("THAI SAN", "THAISAN") ||
    gioVaoTextLooksLikeMaternity(gioVaoRaw);
  const isNoPermit = hasLeaveCode("KP") || hasText("KHONG PHEP");
  const isUnpaidLeave = hasLeaveCode("KL") || hasText("KHONG LUONG");
  const isSickLeave = hasLeaveCode("PO") || hasText("PHEP OM", "NGHI OM");
  /** Phép tang: giờ vào + chấm công / PN (ghi chú) — đồng bộ với dropdown & Excel */
  const isFuneralLeave =
    textMatchesFuneralLeave(gioVaoRaw) ||
    textMatchesFuneralLeave(emp.chamCong) ||
    textMatchesFuneralLeave(emp.phepNam) ||
    textMatchesFuneralLeave(emp.pnTon);
  const isResignedLeave = hasLeaveCode("NV") || hasText("NGHI VIEC");
  const isNightShift =
    caLamViecNormalized.includes("đêm") ||
    caLamViecNormalized.includes("dem") ||
    caLamViecNormalized.includes("night");

  /** Khớp từng loại trong ATTENDANCE_GIO_VAO_TYPE_OPTIONS trên Giờ vào + ghi chú liên quan */
  const scanRaws = [
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

  return {
    nonStandardTimeIn,
    checkedIn: hasCheckIn,
    coDiLam: coDiLam || typeHitKeys.has("coDiLam"),
    late: isLate || typeHitKeys.has("late"),
    annualLeave: isAnnualLeave || typeHitKeys.has("annualLeave"),
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
