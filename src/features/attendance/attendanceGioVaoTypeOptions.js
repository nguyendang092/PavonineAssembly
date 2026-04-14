/**
 * Giá trị `gioVao` dạng loại phép / trạng thái (không phải HH:MM).
 * Dùng chung: dropdown điểm danh, thời vụ, gợi ý modal, lọc bù công.
 * Khi thêm loại mới: cập nhật mảng này + comboStatKey + getAttendanceComboFlags (attendanceComboStats.js).
 */

export const ATTENDANCE_GIO_VAO_TYPE_OPTIONS = [
  { value: "Có đi làm", shortLabel: "Có", comboStatKey: "coDiLam" },
  { value: "Vào trễ", shortLabel: "Vào trễ", comboStatKey: "late" },
  { value: "Phép năm", shortLabel: "PN", comboStatKey: "annualLeave" },
  { value: "1/2 Phép năm", shortLabel: "1/2 PN", comboStatKey: "annualLeave" },
  { value: "Không lương", shortLabel: "KL", comboStatKey: "unpaidLeave" },
  { value: "Không phép", shortLabel: "KP", comboStatKey: "noPermit" },
  { value: "Thai sản", shortLabel: "TS", comboStatKey: "maternity" },
  { value: "Phép ốm", shortLabel: "PO", comboStatKey: "sickLeave" },
  { value: "Tai nạn", shortLabel: "TN", comboStatKey: "laborAccident" },
  { value: "Phép cưới", shortLabel: "PC", comboStatKey: "weddingLeave" },
  { value: "Phép tang", shortLabel: "PT", comboStatKey: "funeralLeave" },
  { value: "Dưỡng sức", shortLabel: "DS", comboStatKey: "recuperationLeave" },
  { value: "Phép công tác", shortLabel: "PCT", comboStatKey: "annualLeave" },
  { value: "Nghỉ việc", shortLabel: "NV", comboStatKey: "resignedLeave" },
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
  (a, b) => foldGioVaoCompare(b.value).length - foldGioVaoCompare(a.value).length,
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
  "CDL",
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
