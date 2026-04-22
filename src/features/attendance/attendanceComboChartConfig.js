/**
 * Thống kê combo theo bộ phận — khóa đếm + cấu hình ô KPI / cột biểu đồ.
 * Đồng bộ với ATTENDANCE_LOAI_PHEP_OPTIONS (comboStatKey).
 */

/** Các trường cộng dồn trên mỗi dòng bộ phận (không gồm total, department). */
export const COMBO_CHART_METRIC_KEYS = [
  "checkedIn",
  "buGioCong",
  "nonStandardTimeIn",
  "timeInHashHHMM",
  "late",
  "annualLeave",
  "halfAnnualLeave",
  "nightShift",
  "laborAccident",
  "maternity",
  "weddingLeave",
  "funeralLeave",
  "recuperationLeave",
  "noPermit",
  "unpaidLeave",
  "sickLeave",
  "resignedLeave",
];

/** Nhãn mặc định (tl key = cùng tên field). */
export const COMBO_STAT_LABEL_DEFAULTS = {
  checkedIn: "Chấm công",
  buGioCong: "Bù giờ công",
  nonStandardTimeIn: "Giờ vào ≠ HH:MM",
  timeInHashHHMM: "Giờ vào # HH:MM",
  late: "Vào trễ",
  annualLeave: "Phép năm",
  halfAnnualLeave: "1/2 phép năm",
  nightShift: "Ca đêm",
  laborAccident: "Tai nạn",
  maternity: "Thai sản",
  weddingLeave: "Phép cưới",
  funeralLeave: "Phép tang",
  recuperationLeave: "Dưỡng sức",
  noPermit: "Không phép",
  unpaidLeave: "Không lương",
  sickLeave: "Phép ốm",
  resignedLeave: "Nghỉ việc",
};

/**
 * Nhân sự: BGC, vào trễ, ca đêm + các loại phép & trạng thái nghỉ.
 * Sản xuất: tổng nhân viên + chấm công (rộng), giờ vào lệch / # HH:MM.
 */
export const COMBO_DASHBOARD_TILE_KEYS_HR = [
  "buGioCong",
  "late",
  "nightShift",
  "annualLeave",
  "halfAnnualLeave",
  "maternity",
  "weddingLeave",
  "funeralLeave",
  "recuperationLeave",
  "noPermit",
  "unpaidLeave",
  "sickLeave",
  "laborAccident",
  "resignedLeave",
];

export const COMBO_DASHBOARD_TILE_KEYS_PRODUCTION = [
  "checkedIn",
  "nonStandardTimeIn",
  "timeInHashHHMM",
];

/** Nhóm Sản xuất (thống kê): chấm công + chi tiết từng loại phép / chỉ số như HR. */
export const COMBO_DASHBOARD_TILE_KEYS_PRODUCTION_DETAIL = [
  "checkedIn",
  ...COMBO_DASHBOARD_TILE_KEYS_HR,
];

const COMBO_STATS_PRODUCTION_DEPT_MATCH_KEYS = new Set([
  "extrusion",
  "mc",
  "hairline",
  "press",
  "anodizing",
  "assy",
  "assydeco",
  "assyflip",
  "assykomsa",
  "assyohf",
  "assypmf",
  "assytu",
]);

/** Thứ tự mặc định khi chưa cấu hình — thêm BP mới: chỉ cần bổ sung vào Set + nhãn picker. */
export const COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER = Array.from(
  COMBO_STATS_PRODUCTION_DEPT_MATCH_KEYS,
).sort();

/** Nhãn hiển thị trong UI chọn BP sản xuất (theo `matchKey`). */
export const COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS = {
  extrusion: "Extrusion",
  mc: "MC",
  hairline: "HairLine",
  press: "Press",
  anodizing: "Anodizing",
  assy: "Assy",
  assydeco: "Assy-Deco",
  assyflip: "Assy-Flip",
  assykomsa: "Assy-Komsa",
  assyohf: "Assy-OHF",
  assypmf: "Assy-PMF",
  assytu: "Assy-TU",
};

/**
 * Khóa so khớp BP sản xuất (chữ thường, bỏ khoảng trắng và `-`).
 * Dùng cùng quy tắc với `matchesComboStatsProductionDepartment`.
 */
export function attendanceProductionDeptMatchKey(normalizeDepartment, boPhanRaw) {
  const normalized = normalizeDepartment(boPhanRaw);
  if (!normalized) return "";
  return normalized.replace(/\s+/g, "").replace(/-/g, "");
}

export function matchesComboStatsProductionDepartment(
  normalizeDepartment,
  boPhanRaw,
) {
  const matchKey = attendanceProductionDeptMatchKey(
    normalizeDepartment,
    boPhanRaw,
  );
  if (!matchKey) return false;
  return COMBO_STATS_PRODUCTION_DEPT_MATCH_KEYS.has(matchKey);
}

/**
 * Sắp xếp hàng biểu đồ theo thứ tự `matchKey` đã lưu; phần còn lại theo `total` giảm dần.
 */
/**
 * Thứ tự mở picker: BP mặc định trong config trước, sau đó mọi BP có trong `catalog` (dữ liệu ngày).
 */
export function mergeComboProductionDeptPickerKeys(catalog) {
  const seen = new Set();
  const out = [];
  for (const mk of COMBO_STATS_PRODUCTION_DEPT_DEFAULT_ORDER) {
    if (!seen.has(mk)) {
      seen.add(mk);
      out.push(mk);
    }
  }
  const list = Array.isArray(catalog) ? catalog : [];
  for (const item of list) {
    const mk = item?.matchKey;
    if (typeof mk !== "string" || !mk || seen.has(mk)) continue;
    seen.add(mk);
    out.push(mk);
  }
  return out;
}

export function applyProductionStatsRowOrder(
  rows,
  matchKeyOrder,
  normalizeDepartment,
) {
  if (!rows?.length) return [];
  if (!matchKeyOrder?.length) return [...rows];
  const seen = new Set();
  const out = [];
  for (const mk of matchKeyOrder) {
    for (const r of rows) {
      if (seen.has(r.department)) continue;
      const rk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        r.department,
      );
      if (rk === mk) {
        out.push(r);
        seen.add(r.department);
      }
    }
  }
  const rest = rows.filter((r) => !seen.has(r.department));
  rest.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  return [...out, ...rest];
}

/** Ô KPI: chỉ hiện khi đếm > 0 — màu số dùng `getAttendanceLeaveTypeColorClassNameForComboStatKey`. */
export const COMBO_DASHBOARD_TILES = [
  { key: "checkedIn", tlKey: "checkedIn" },
  { key: "buGioCong", tlKey: "buGioCong" },
  { key: "nonStandardTimeIn", tlKey: "nonStandardTimeIn" },
  { key: "timeInHashHHMM", tlKey: "timeInHashHHMM" },
  { key: "late", tlKey: "late" },
  { key: "annualLeave", tlKey: "annualLeave" },
  { key: "halfAnnualLeave", tlKey: "halfAnnualLeave" },
  { key: "nightShift", tlKey: "nightShift" },
  { key: "laborAccident", tlKey: "laborAccident" },
  { key: "maternity", tlKey: "maternity" },
  { key: "weddingLeave", tlKey: "weddingLeave" },
  { key: "funeralLeave", tlKey: "funeralLeave" },
  { key: "recuperationLeave", tlKey: "recuperationLeave" },
  { key: "noPermit", tlKey: "noPermit" },
  { key: "unpaidLeave", tlKey: "unpaidLeave" },
  { key: "sickLeave", tlKey: "sickLeave" },
  { key: "resignedLeave", tlKey: "resigned" },
];

/** Tooltip + Bar: thứ tự vẽ (trái → phải) — fill từ `getAttendanceComboBarFillForMetricKey`. */
export const COMBO_BAR_SERIES = COMBO_CHART_METRIC_KEYS.map((dataKey) => ({
  dataKey,
}));
