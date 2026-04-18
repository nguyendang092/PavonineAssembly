/**
 * Thống kê combo theo bộ phận — khóa đếm + cấu hình ô KPI / cột biểu đồ.
 * Đồng bộ với ATTENDANCE_GIO_VAO_TYPE_OPTIONS (comboStatKey).
 */

/** Các trường cộng dồn trên mỗi dòng bộ phận (không gồm total, department). */
export const COMBO_CHART_METRIC_KEYS = [
  "checkedIn",
  "coDiLam",
  "nonStandardTimeIn",
  "late",
  "annualLeave",
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
  checkedIn: "Đã chấm công",
  coDiLam: "Có đi làm",
  nonStandardTimeIn: "Giờ vào ≠ HH:MM",
  late: "Vào trễ",
  annualLeave: "Phép năm",
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

/** Ô KPI: chỉ hiện khi đếm > 0 — màu số dùng `getAttendanceLeaveTypeColorClassNameForComboStatKey`. */
export const COMBO_DASHBOARD_TILES = [
  { key: "checkedIn", tlKey: "checkedIn" },
  { key: "coDiLam", tlKey: "coDiLam" },
  { key: "nonStandardTimeIn", tlKey: "nonStandardTimeIn" },
  { key: "late", tlKey: "late" },
  { key: "annualLeave", tlKey: "annualLeave" },
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
