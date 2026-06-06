/**
 * Giới tính điểm danh — lưu Firebase: `YES` (Nữ), `NO` (Nam).
 * Excel / legacy có thể ghi «Nam», «Nữ», «YES (Nữ)»…
 */

export function normalizeAttendanceGioiTinhValue(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const upper = s.toUpperCase();
  const ascii = upper
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

  if (
    ascii === "YES" ||
    ascii === "Y" ||
    ascii === "NU" ||
    ascii === "FEMALE" ||
    ascii === "F" ||
    upper === "NỮ" ||
    upper.includes("NỮ") ||
    s === "Nữ" ||
    /YES.*NU/.test(ascii) ||
    /NU.*YES/.test(ascii)
  ) {
    return "YES";
  }

  if (
    ascii === "NO" ||
    ascii === "NAM" ||
    ascii === "MALE" ||
    ascii === "M" ||
    s === "Nam" ||
    /NO.*NAM/.test(ascii) ||
    /NAM.*NO/.test(ascii)
  ) {
    return "NO";
  }

  return "";
}

export function isAttendanceFemaleGioiTinh(raw) {
  return normalizeAttendanceGioiTinhValue(raw) === "YES";
}

/** Nhãn hiển thị bảng — khớp form (`femaleLabel` / `maleLabel`). */
export function formatAttendanceGenderDisplay(raw, labels = {}) {
  const norm = normalizeAttendanceGioiTinhValue(raw);
  if (norm === "YES") return labels.female ?? "Nữ";
  if (norm === "NO") return labels.male ?? "Nam";
  const trimmed = String(raw ?? "").trim();
  return trimmed || "—";
}
