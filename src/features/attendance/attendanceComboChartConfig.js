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

/**
 * Ô KPI: chỉ hiện khi đếm > 0 (gọn giao diện).
 * activeNumClass: màu số.
 */
export const COMBO_DASHBOARD_TILES = [
  {
    key: "checkedIn",
    tlKey: "checkedIn",
    activeNumClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "coDiLam",
    tlKey: "coDiLam",
    activeNumClass: "text-green-700 dark:text-green-400",
  },
  {
    key: "nonStandardTimeIn",
    tlKey: "nonStandardTimeIn",
    activeNumClass: "text-cyan-600 dark:text-cyan-400",
  },
  {
    key: "late",
    tlKey: "late",
    activeNumClass: "text-lime-700 dark:text-lime-400",
  },
  {
    key: "annualLeave",
    tlKey: "annualLeave",
    activeNumClass: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "nightShift",
    tlKey: "nightShift",
    activeNumClass: "text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "laborAccident",
    tlKey: "laborAccident",
    activeNumClass: "text-rose-600 dark:text-rose-400",
  },
  {
    key: "maternity",
    tlKey: "maternity",
    activeNumClass: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    key: "weddingLeave",
    tlKey: "weddingLeave",
    activeNumClass: "text-pink-600 dark:text-pink-400",
  },
  {
    key: "funeralLeave",
    tlKey: "funeralLeave",
    activeNumClass: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "recuperationLeave",
    tlKey: "recuperationLeave",
    activeNumClass: "text-teal-700 dark:text-teal-400",
  },
  {
    key: "noPermit",
    tlKey: "noPermit",
    activeNumClass: "text-red-600 dark:text-red-400",
  },
  {
    key: "unpaidLeave",
    tlKey: "unpaidLeave",
    activeNumClass: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "sickLeave",
    tlKey: "sickLeave",
    activeNumClass: "text-teal-600 dark:text-teal-400",
  },
  {
    key: "resignedLeave",
    tlKey: "resigned",
    activeNumClass: "text-slate-700 dark:text-slate-300",
  },
];

/** Tooltip + Bar: thứ tự vẽ (trái → phải). */
export const COMBO_BAR_SERIES = [
  { dataKey: "checkedIn", fill: "#10b981" },
  { dataKey: "coDiLam", fill: "#15803d" },
  { dataKey: "nonStandardTimeIn", fill: "#06b6d4" },
  { dataKey: "late", fill: "#65a30d" },
  { dataKey: "annualLeave", fill: "#f59e0b" },
  { dataKey: "nightShift", fill: "#6366f1" },
  { dataKey: "laborAccident", fill: "#f43f5e" },
  { dataKey: "maternity", fill: "#d946ef" },
  { dataKey: "weddingLeave", fill: "#ec4899" },
  { dataKey: "funeralLeave", fill: "#6d28d9" },
  { dataKey: "recuperationLeave", fill: "#0e7490" },
  { dataKey: "noPermit", fill: "#dc2626" },
  { dataKey: "unpaidLeave", fill: "#ea580c" },
  { dataKey: "sickLeave", fill: "#0d9488" },
  { dataKey: "resignedLeave", fill: "#475569" },
];
