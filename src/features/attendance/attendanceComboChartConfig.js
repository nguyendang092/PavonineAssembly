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
