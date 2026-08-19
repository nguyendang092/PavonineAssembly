/** Công đoạn cố định trên báo cáo S90D (theo mẫu Excel). */
export const S90D_PROCESSES = Object.freeze([
  "PRESS",
  "HAIRLINE",
  "ANODIZING",
  "ASSEMBLY",
]);

/** Cột lỗi chi tiết — nhãn song ngữ theo mẫu Excel mới nhất. */
export const S90D_DEFECT_COLUMNS = Object.freeze([
  { key: "rawMaterial", ko: "원자재", vi: "Nguyên liệu", shortVi: "NL" },
  { key: "pressDefect", ko: "PRESS 불량", vi: "Lỗi dập", shortVi: "Dập" },
  { key: "burr", ko: "칩눌림 불량", vi: "Lỗi ấn Bavia", shortVi: "Bavia" },
  { key: "scratch", ko: "스크러치", vi: "Trầy, xước", shortVi: "Trầy" },
  { key: "dent", ko: "찍힘", vi: "Cấn", shortVi: "Cấn" },
  { key: "breakage", ko: "파손 불량", vi: "Lỗi gãy", shortVi: "Gãy" },
  { key: "bendWarp", ko: "휨 불량", vi: "Lỗi cong, vênh", shortVi: "Cong" },
  { key: "hole", ko: "홀 불량", vi: "Lỗi hole", shortVi: "Hole" },
  { key: "sanding", ko: "사상불량", vi: "Lỗi chà", shortVi: "Chà" },
  { key: "tape", ko: "피막 불량", vi: "Lỗi nhuộm", shortVi: "Nhuộm" },
  { key: "stain", ko: "얼룩 불량", vi: "Lỗi loang màu", shortVi: "Loang" },
  { key: "corrosion", ko: "부식", vi: "Ăn mòn", shortVi: "Mòn" },
  { key: "color", ko: "컬러", vi: "Màu", shortVi: "Màu" },
  { key: "whiteSpot", ko: "백점 불량", vi: "Lỗi chấm trắng", shortVi: "Chấm" },
  {
    key: "assemblyDefect",
    ko: "조립 불량",
    vi: "Lỗi Lắp ráp",
    shortVi: "L ráp",
  },
  { key: "bending", ko: "벤딩불량", vi: "Lỗi bending", shortVi: "Bend" },
  {
    key: "hairlineDefect",
    ko: "헤어라인 불량",
    vi: "Lỗi Hairline",
    shortVi: "Hair",
  },
]);

export function createEmptyDefectCounts() {
  return Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, 0]));
}

export function normalizeS90dProcess(workplaceName) {
  const upper = String(workplaceName ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (upper.includes("PRESS") || upper.includes("FRÉ") || upper === "프레스") {
    return "PRESS";
  }
  if (upper === "GE") return "GE";
  if (upper === "MC" || upper.includes("MACHINING")) {
    return "MC";
  }
  if (upper.includes("HAIRLINE") || upper.includes("HAIR LINE")) {
    return "HAIRLINE";
  }
  if (upper.includes("ANODIZ")) return "ANODIZING";
  if (upper.includes("ASSEMBLY") || upper.includes("조립")) return "ASSEMBLY";
  if (S90D_PROCESSES.includes(upper)) return upper;
  return null;
}

export function sumDefectCounts(defects) {
  return S90D_DEFECT_COLUMNS.reduce(
    (sum, { key }) => sum + (defects[key] ?? 0),
    0,
  );
}
