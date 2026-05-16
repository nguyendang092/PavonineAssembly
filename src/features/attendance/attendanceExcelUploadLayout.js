function normalizeHeaderCell(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Tìm cặp 2 dòng tiêu đề (VN + EN) giống file xuất điểm danh / mẫu, hoặc sheet 2 dòng đầu (legacy).
 * @returns {{ dataRowStart: number; mnvCol: number }}
 */
export function findAttendanceExcelLayout(rows) {
  if (!Array.isArray(rows) || rows.length < 3) {
    return { dataRowStart: 2, mnvCol: 1 };
  }

  for (let i = 0; i <= rows.length - 2; i++) {
    const rv = rows[i];
    if (!Array.isArray(rv) || rv.length < 3) continue;
    const c0 = normalizeHeaderCell(rv[0]);
    const c1 = normalizeHeaderCell(rv[1]);
    const c2 = normalizeHeaderCell(rv[2]);
    if (c0 !== "stt" && c0 !== "số thứ tự" && c0 !== "no." && c0 !== "no")
      continue;

    if (c1 === "mnv" || c1 === "mã nhân viên" || c1 === "mã nv") {
      return { dataRowStart: i + 2, mnvCol: 1 };
    }
    if (
      (c1.includes("ngày") || c1 === "date") &&
      (c2 === "mnv" || c2 === "mã nhân viên" || c2 === "mã nv")
    ) {
      return { dataRowStart: i + 2, mnvCol: 2 };
    }
  }

  return { dataRowStart: 2, mnvCol: 1 };
}
