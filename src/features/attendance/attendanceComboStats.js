/** Logic cờ thống kê combo (điểm danh) — dùng cho modal Thống kê và bảng chi tiết KPI */

export const normalizeTextValue = (value) => String(value ?? "").trim();

/** Giờ chuẩn HH:MM (hoặc HH:MM:SS), không nhận text loại phép / ngoài 24h */
export const GIO_VAO_HHMM_STRICT = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Cùng logic với thống kê combo chart — dùng cho bảng chi tiết khi bấm KPI */
export function getAttendanceComboFlags(emp) {
  const gioVaoRaw = normalizeTextValue(emp.gioVao);
  const isTimeFormat = /^\d{1,2}:\d{2}(:\d{2})?$/.test(gioVaoRaw);
  const nonStandardTimeIn =
    gioVaoRaw !== "" && !GIO_VAO_HHMM_STRICT.test(gioVaoRaw);
  const gioVaoNormalized = normalizeTextValue(emp.gioVao).toUpperCase();
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
  const isAnnualLeave =
    hasLeaveCode("PN") || hasText("PHEP NAM", "1/2PHEPNAM", "1/2 PN");
  const isLaborAccident = hasLeaveCode("TN") || hasText("TNLD", "TAI NAN");
  const isMaternity = hasLeaveCode("TS") || hasText("THAI SAN");
  const isNoPermit = hasLeaveCode("KP") || hasText("KHONG PHEP");
  const isUnpaidLeave = hasLeaveCode("KL") || hasText("KHONG LUONG");
  const isSickLeave = hasLeaveCode("PO") || hasText("PHEP OM", "NGHI OM");
  const isResignedLeave = hasLeaveCode("NV") || hasText("NGHI VIEC");
  const isNightShift =
    caLamViecNormalized.includes("đêm") ||
    caLamViecNormalized.includes("dem") ||
    caLamViecNormalized.includes("night");
  return {
    nonStandardTimeIn,
    checkedIn: hasCheckIn,
    late: isLate,
    annualLeave: isAnnualLeave,
    nightShift: isNightShift,
    laborAccident: isLaborAccident,
    maternity: isMaternity,
    noPermit: isNoPermit,
    unpaidLeave: isUnpaidLeave,
    sickLeave: isSickLeave,
    resignedLeave: isResignedLeave,
  };
}
