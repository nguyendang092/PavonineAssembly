/**
 * Hiển thị `trangThaiLamViec` (Firebase) trên bảng điểm danh / lương.
 * `tl`: `t("attendanceList.*", { defaultValue })`.
 */
/** Xuất Excel / log — nhãn tiếng Việt cố định. */
export function formatTrangThaiLamViecPlain(raw) {
  const v = String(raw ?? "").trim();
  switch (v) {
    case "dang_lam":
      return "Chính thức";
    case "thu_viec":
      return "Thử việc";
    case "nghi_viec":
      return "Nghỉ việc";
    case "thai_san":
      return "Thai sản";
    case "tam_nghi":
      return "Tạm nghỉ";
    default:
      return v;
  }
}

export function formatTrangThaiLamViecTableCell(raw, tl) {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  switch (v) {
    case "dang_lam":
      return tl("employmentStatusOfficial", "Chính thức");
    case "thu_viec":
      return tl("employmentStatusProbation", "Thử việc");
    case "nghi_viec":
      return tl("employmentStatusResigned", "Nghỉ việc");
    case "thai_san":
      return tl("employmentStatusMaternity", "Thai sản");
    case "tam_nghi":
      return tl("employmentStatusSuspended", "Tạm nghỉ");
    default:
      return v;
  }
}

/**
 * Ô mẫu Excel «Trạng thái LV» → mã Firebase (`dang_lam`, …).
 * Nhận mã snake_case, nhãn từ `formatTrangThaiLamViecPlain`, hoặc EN gợi ý cột.
 */
export function parseTrangThaiLamViecFromExcel(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";

  const compact = t.replace(/\s+/g, " ");
  const ascii = compact
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const direct = new Set([
    "dang_lam",
    "thu_viec",
    "nghi_viec",
    "thai_san",
    "tam_nghi",
  ]);
  if (direct.has(compact)) return compact;
  if (direct.has(ascii)) return ascii;

  const aliases = {
    "chinh thuc": "dang_lam",
    "thu viec": "thu_viec",
    "nghi viec": "nghi_viec",
    "thai san": "thai_san",
    "tam nghi": "tam_nghi",
    official: "dang_lam",
    probation: "thu_viec",
    resigned: "nghi_viec",
    maternity: "thai_san",
    suspended: "tam_nghi",
  };
  if (aliases[ascii]) return aliases[ascii];

  const byPlainVi = {
    chinhthuc: "dang_lam",
    thuviec: "thu_viec",
    nghiviec: "nghi_viec",
    thaisan: "thai_san",
    tamnghi: "tam_nghi",
  };
  const noSpace = ascii.replace(/\s/g, "");
  if (byPlainVi[noSpace]) return byPlainVi[noSpace];

  return compact;
}
