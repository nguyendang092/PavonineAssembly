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
  { key: "burr", ko: "칩눌림 불량", vi: "Lỗi ăn Bavia", shortVi: "Bavia" },
  { key: "scratch", ko: "스크러치", vi: "Trầy, xước", shortVi: "Trầy" },
  { key: "dent", ko: "찍힘", vi: "Cấn", shortVi: "Cấn" },
  { key: "breakage", ko: "Lỗi gãy", vi: "Lỗi gãy", shortVi: "Gãy" },
  { key: "bendWarp", ko: "벤딩 불량", vi: "Lỗi cong, vênh", shortVi: "Cong" },
  { key: "hole", ko: "홀 불량", vi: "Lỗi hole", shortVi: "Hole" },
  { key: "sanding", ko: "헤어 불량", vi: "Lỗi chà", shortVi: "Chà" },
  { key: "tape", ko: "피막 불량", vi: "Lỗi nhuộm", shortVi: "Nhuộm" },
  { key: "stain", ko: "얼룩 불량", vi: "Lỗi loang màu", shortVi: "Loang" },
  { key: "corrosion", ko: "부식", vi: "Ăn mòn", shortVi: "Mòn" },
  { key: "color", ko: "컬러", vi: "Màu", shortVi: "Màu" },
  { key: "whiteSpot", ko: "백점 불량", vi: "Lỗi chấm trắng", shortVi: "Chấm" },
  { key: "assemblyDefect", ko: "조립 불량", vi: "Lỗi Lắp ráp", shortVi: "L ráp" },
  { key: "bending", ko: "Lỗi bending", vi: "Lỗi bending", shortVi: "Bend" },
  { key: "hairlineDefect", ko: "Lỗi Hairline", vi: "Lỗi Hairline", shortVi: "Hair" },
]);

/** Gom tên lỗi từ Excel/Firebase → key cột lỗi. */
const REASON_TO_DEFECT_KEY = [
  [/원자재|nguyên liệu|raw.?material/i, "rawMaterial"],
  [/press|dập|프레스/i, "pressDefect"],
  [/칩눌|침눌|bavia|burr|ăn bavia/i, "burr"],
  [/scratch|스크러치|스크래치|trầy|xước/i, "scratch"],
  [/찍힘|cấn|dent|mark/i, "dent"],
  [/gãy|break|crack/i, "breakage"],
  [/cong|vênh|warp|벤딩/i, "bendWarp"],
  [/^(?!.*hair).*bending|lỗi bending/i, "bending"],
  [/hole|홀(?!\s*불)|lỗ hole/i, "hole"],
  [/chà|헤어|샌딩/i, "sanding"],
  [/nhuộm|피막|tape|테이프|dye|anodiz/i, "tape"],
  [/loang|stain|얼룩/i, "stain"],
  [/ăn mòn|corrosion|부식/i, "corrosion"],
  [/màu|color|컬러/i, "color"],
  [/chấm trắng|white.?spot|백점/i, "whiteSpot"],
  [/lắp ráp|assembly|조립/i, "assemblyDefect"],
  [/hairline|헤어라인|lỗi hairline/i, "hairlineDefect"],
];

export function createEmptyDefectCounts() {
  return Object.fromEntries(S90D_DEFECT_COLUMNS.map(({ key }) => [key, 0]));
}

export function mapReasonToDefectKey(reason) {
  const text = String(reason ?? "").trim();
  if (!text) return null;
  for (const [pattern, key] of REASON_TO_DEFECT_KEY) {
    if (pattern.test(text)) return key;
  }
  return null;
}

export function normalizeS90dProcess(workplaceName) {
  const upper = String(workplaceName ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (upper.includes("PRESS") || upper.includes("FRÉ") || upper === "프레스") {
    return "PRESS";
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
