/**
 * Thống kê combo theo bộ phận — khóa đếm + cấu hình ô KPI / cột biểu đồ.
 * Đồng bộ với ATTENDANCE_LOAI_PHEP_OPTIONS (comboStatKey).
 */

import { normalizeTextValue } from "./attendanceComboStats";

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
  "wrongDepartment",
];

/** i18n: `attendanceList.comboStat.<metricKey>` — xem `useAttendanceListI18n.tlComboStat`. */
export function comboStatI18nKey(metricKey) {
  return `comboStat.${metricKey}`;
}

/**
 * Nhân sự: BGC, vào trễ, ca đêm + các loại phép & trạng thái nghỉ.
 * Sản xuất: tổng nhân viên + chấm công (rộng), giờ vào lệch / # HH:MM.
 */
export const COMBO_DASHBOARD_TILE_KEYS_HR = [
  "wrongDepartment",
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
  "wrongDepartment",
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
export function attendanceProductionDeptMatchKey(
  normalizeDepartment,
  boPhanRaw,
) {
  const normalized = normalizeDepartment(boPhanRaw);
  if (!normalized) return "";
  const compact = normalized.replace(/\s+/g, "").replace(/-/g, "");
  if (COMBO_STATS_PRODUCTION_DEPT_MATCH_KEYS.has(compact)) return compact;
  /** VD «3 MC», «01 Press» → cùng khóa với «MC», «Press» (gộp thống kê + so ngày trước). */
  const withoutLeadingOrdinal = compact.replace(/^\d+/, "");
  if (
    withoutLeadingOrdinal &&
    withoutLeadingOrdinal !== compact &&
    COMBO_STATS_PRODUCTION_DEPT_MATCH_KEYS.has(withoutLeadingOrdinal)
  ) {
    return withoutLeadingOrdinal;
  }
  return compact;
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
 * Nhãn một hàng biểu đồ thống kê: BP sản xuất đã cấu hình gộp theo matchKey
 * (vd. PRESS / Press / press → một hàng «Press»), tránh tách đếm do khác hoa/thường.
 * @param {(v: unknown) => string} normalizeDepartment
 */
export function resolveComboChartDepartmentLabel(
  normalizeDepartment,
  boPhanRaw,
  unknownLabel,
) {
  const trimmed = normalizeTextValue(boPhanRaw);
  if (!trimmed) return unknownLabel;
  if (!matchesComboStatsProductionDepartment(normalizeDepartment, boPhanRaw)) {
    return trimmed;
  }
  const mk = attendanceProductionDeptMatchKey(normalizeDepartment, boPhanRaw);
  return COMBO_STATS_PRODUCTION_DEPT_PICKER_LABELS[mk] ?? trimmed;
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
  { key: "wrongDepartment" },
  { key: "checkedIn" },
  { key: "buGioCong" },
  { key: "nonStandardTimeIn" },
  { key: "timeInHashHHMM" },
  { key: "late" },
  { key: "annualLeave" },
  { key: "halfAnnualLeave" },
  { key: "nightShift" },
  { key: "laborAccident" },
  { key: "maternity" },
  { key: "weddingLeave" },
  { key: "funeralLeave" },
  { key: "recuperationLeave" },
  { key: "noPermit" },
  { key: "unpaidLeave" },
  { key: "sickLeave" },
  { key: "resignedLeave" },
];

/** Tooltip + Bar: thứ tự vẽ (trái → phải) — fill từ `getAttendanceComboBarFillForMetricKey`. */
export const COMBO_BAR_SERIES = COMBO_CHART_METRIC_KEYS.map((dataKey) => ({
  dataKey,
}));
