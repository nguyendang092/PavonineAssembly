/**
 * Giá trị `gioVao` dạng loại phép / trạng thái (không phải HH:MM).
 * Dùng chung: dropdown điểm danh, thời vụ, gợi ý modal, lọc bù công.
 * Khi thêm loại mới: cập nhật mảng này + comboStatKey + getAttendanceComboFlags (attendanceComboStats.js).
 */

export const ATTENDANCE_GIO_VAO_TYPE_OPTIONS = [
  { value: "Đi làm", shortLabel: "BGC", comboStatKey: "coDiLam" },
  { value: "Vào trễ", shortLabel: "VT", comboStatKey: "late" },
  { value: "Phép năm", shortLabel: "PN", comboStatKey: "annualLeave" },
  {
    value: "1/2 Phép năm",
    shortLabel: "1/2PN",
    comboStatKey: "annualLeave",
  },
  {
    value: "Không lương",
    shortLabel: "KL",
    comboStatKey: "unpaidLeave",
  },
  { value: "Không phép", shortLabel: "KP", comboStatKey: "noPermit" },
  { value: "Thai sản", shortLabel: "TS", comboStatKey: "maternity" },
  { value: "Phép ốm", shortLabel: "PO", comboStatKey: "sickLeave" },
  { value: "Tai nạn", shortLabel: "TN", comboStatKey: "laborAccident" },
  { value: "Phép cưới", shortLabel: "PC", comboStatKey: "weddingLeave" },
  /** `value` = mã lưu DB / in biểu (PT); `shortLabel` = tên hiển thị */
  { value: "PT", shortLabel: "PT", comboStatKey: "funeralLeave" },
  {
    value: "Dưỡng sức",
    shortLabel: "DS",
    comboStatKey: "recuperationLeave",
  },
  {
    value: "Công tác",
    shortLabel: "CT",
    comboStatKey: "annualLeave",
  },
  {
    value: "Nghỉ việc",
    shortLabel: "NV",
    comboStatKey: "resignedLeave",
  },
];

/** Gập dấu / khoảng trắng — dùng khớp nhập tay, Excel, NBSP */
export function foldGioVaoCompare(s) {
  return String(s ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Ưu tiên khớp chuỗi dài trước (vd. «1/2 Phép năm» trước «Phép năm»). */
export const ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH = [
  ...ATTENDANCE_GIO_VAO_TYPE_OPTIONS,
].sort(
  (a, b) =>
    foldGioVaoCompare(b.value).length - foldGioVaoCompare(a.value).length,
);

/**
 * Khớp một chuỗi (Giờ vào / chấm công / …) với một lựa chọn dropdown.
 * Không khớp giờ dạng HH:MM (để tránh nhầm với loại).
 */
export function rawMatchesAttendanceTypeOption(raw, option) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return false;

  const f = foldGioVaoCompare(t);
  const fv = foldGioVaoCompare(option.value);
  if (f === fv) return true;

  const fs = foldGioVaoCompare(option.shortLabel);
  if (f === fs) return true;

  const compact = f.replace(/\s/g, "");
  const compactVal = fv.replace(/\s/g, "");
  if (compact === compactVal) return true;

  const shortTok = fs.replace(/\s/g, "");
  if (shortTok.length < 2) return false;

  const latin = t
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ");
  const tokens = latin
    .split(/[^A-Z0-9/]+/)
    .flatMap((x) => x.split("/"))
    .filter(Boolean);
  if (tokens.includes(shortTok)) return true;

  return false;
}

/**
 * Chuẩn hóa chuỗi hiển thị `gioVao`:
 * - Nếu là loại phép/trạng thái trong options: hiển thị `shortLabel`
 * - Nếu là giờ HH:MM hoặc dữ liệu khác: giữ nguyên (trim)
 * @param {unknown} raw
 * @returns {string}
 */
export function formatAttendanceGioVaoDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  return matched?.shortLabel || t;
}

/** Cột «Thời gian vào»: chỉ HH:MM (không hiển thị loại phép). */
export function formatAttendanceTimeInColumnDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t;
  return "";
}

/** Cột «Loại phép»: viết tắt loại / trạng thái; rỗng nếu `gioVao` là giờ HH:MM. */
export function formatAttendanceLeaveTypeColumnDisplay(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!t) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return "";
  return formatAttendanceGioVaoDisplay(t);
}

/**
 * Giá trị lưu cho cột «Loại phép» (tách khỏi giờ HH:MM trên `gioVao`).
 * Ưu tiên `loaiPhep` theo ngày; fallback dữ liệu cũ: cả chuỗi trong `gioVao` khi không phải giờ.
 * @param {Record<string, unknown> | null | undefined} emp
 * @returns {string}
 */
export function getAttendanceLeaveTypeRaw(emp) {
  if (emp == null || typeof emp !== "object") return "";
  const loai = String(emp.loaiPhep ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (loai) return loai;
  const gv = String(emp.gioVao ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!gv) return "";
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(gv)) return "";
  return gv;
}

/** Cột «Loại phép» từ bản ghi nhân viên (có `loaiPhep` + tương thích cũ). */
export function formatAttendanceLeaveTypeColumnForEmployee(emp) {
  return formatAttendanceLeaveTypeColumnDisplay(
    getAttendanceLeaveTypeRaw(emp),
  );
}

/**
 * Màu chữ loại phép (điểm danh / lương / thống kê):
 * TS — xanh dương; PN & 1/2PN — xanh lá; NV — xám; còn lại — đỏ; không khớp chuẩn — đỏ.
 * @param {unknown} raw — `loaiPhep` hoặc chuỗi tương đương (shortLabel cũng khớp).
 */
export function getAttendanceLeaveTypeColorClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "text-gray-500 dark:text-gray-400";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return "text-red-600 dark:text-red-400";
  }
  const sl = matched.shortLabel;
  if (sl === "TS") return "text-blue-600 dark:text-blue-400";
  if (sl === "PN" || sl === "1/2PN") {
    return "text-green-600 dark:text-green-400";
  }
  if (sl === "NV") return "text-gray-600 dark:text-gray-400";
  return "text-red-600 dark:text-red-400";
}

export function getAttendanceLeaveTypeColorClassNameForEmployee(emp) {
  return getAttendanceLeaveTypeColorClassName(getAttendanceLeaveTypeRaw(emp));
}

/**
 * Badge «Phân loại phép» (tóm tắt): nền + chữ + viền theo cùng quy tắc.
 */
export function getAttendanceLeaveTypeBadgeClassName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) {
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  }
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  if (!matched) {
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
  }
  const sl = matched.shortLabel;
  if (sl === "TS") {
    return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
  }
  if (sl === "PN" || sl === "1/2PN") {
    return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
  }
  if (sl === "NV") {
    return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600";
  }
  return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
}

/** In trang (`window.print`): style inline theo cùng quy tắc màu. */
export function getAttendanceLeaveTypePrintStyleAttr(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const matched = ATTENDANCE_GIO_VAO_OPTIONS_BY_VALUE_LENGTH.find((opt) =>
    rawMatchesAttendanceTypeOption(t, opt),
  );
  const base = "font-weight:bold;";
  if (!matched) return `${base}color:#dc2626;`;
  const sl = matched.shortLabel;
  if (sl === "TS") return `${base}color:#2563eb;`;
  if (sl === "PN" || sl === "1/2PN") return `${base}color:#16a34a;`;
  if (sl === "NV") return `${base}color:#4b5563;`;
  return `${base}color:#dc2626;`;
}

export function getAttendanceLeaveTypePrintStyleAttrForEmployee(emp) {
  return getAttendanceLeaveTypePrintStyleAttr(getAttendanceLeaveTypeRaw(emp));
}

/**
 * Attendance Dashboard (thống kê combo): `comboStatKey` → class chữ giống cột Loại phép.
 * Metric không có trong options (checkedIn, nonStandardTimeIn, nightShift): màu tách biệt.
 */
export function getAttendanceLeaveTypeColorClassNameForComboStatKey(metricKey) {
  const opt = ATTENDANCE_GIO_VAO_TYPE_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) return getAttendanceLeaveTypeColorClassName(opt.shortLabel);
  switch (metricKey) {
    case "checkedIn":
      return "text-emerald-600 dark:text-emerald-400";
    case "nonStandardTimeIn":
      return "text-cyan-600 dark:text-cyan-400";
    case "nightShift":
      return "text-indigo-600 dark:text-indigo-400";
    default:
      return "text-slate-600 dark:text-slate-400";
  }
}

export function getAttendanceLeaveTypeBadgeClassNameForComboStatKey(metricKey) {
  const opt = ATTENDANCE_GIO_VAO_TYPE_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) return getAttendanceLeaveTypeBadgeClassName(opt.shortLabel);
  switch (metricKey) {
    case "checkedIn":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "nonStandardTimeIn":
      return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800";
    case "nightShift":
      return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  }
}

/** Màu fill cột Bar (Recharts) — đồng bộ TS / PN / NV / đỏ / … */
export function getAttendanceComboBarFillForMetricKey(metricKey) {
  const opt = ATTENDANCE_GIO_VAO_TYPE_OPTIONS.find(
    (o) => o.comboStatKey === metricKey,
  );
  if (opt) {
    const sl = opt.shortLabel;
    if (sl === "TS") return "#2563eb";
    if (sl === "PN" || sl === "1/2PN") return "#16a34a";
    if (sl === "NV") return "#64748b";
    return "#dc2626";
  }
  switch (metricKey) {
    case "checkedIn":
      return "#10b981";
    case "nonStandardTimeIn":
      return "#06b6d4";
    case "nightShift":
      return "#6366f1";
    default:
      return "#94a3b8";
  }
}

/** Giá trị đã gập dấu (để khớp dữ liệu nhập tay / Excel). */
const FOLDED_OPTION_VALUES = ATTENDANCE_GIO_VAO_TYPE_OPTIONS.map((o) =>
  foldGioVaoCompare(o.value),
);

/** Viết tắt / biến thể lưu sẵn trong DB */
const FOLDED_EXTRA_LEAVE_MARKERS = [
  "PN",
  "PO",
  "TS",
  "KL",
  "KP",
  "TN",
  "PC",
  "PT",
  "DS",
  "NV",
  "VT",
  "BGC",
  "PCT",
  "PN1/2",
  "1/2PN",
  "1/2 PN",
];

const BU_CONG_LEAVE_FOLDED_SET = new Set();
for (const v of FOLDED_OPTION_VALUES) {
  BU_CONG_LEAVE_FOLDED_SET.add(v);
  BU_CONG_LEAVE_FOLDED_SET.add(v.replace(/\s/g, ""));
}
for (const x of FOLDED_EXTRA_LEAVE_MARKERS) {
  const fx = foldGioVaoCompare(x);
  BU_CONG_LEAVE_FOLDED_SET.add(fx);
  BU_CONG_LEAVE_FOLDED_SET.add(fx.replace(/\s/g, ""));
}

/**
 * `gioVao` là loại phép/trạng thái (không phải giờ) — dùng lọc bù công & tương tự.
 */
export function isGioVaoLeaveOrStatusType(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (/^\d{1,2}:\d{2}/.test(s)) return false;
  const f = foldGioVaoCompare(s);
  if (BU_CONG_LEAVE_FOLDED_SET.has(f)) return true;
  const compact = f.replace(/\s/g, "");
  if (BU_CONG_LEAVE_FOLDED_SET.has(compact)) return true;
  return false;
}
