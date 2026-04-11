/**
 * Giá trị `gioVao` dạng loại phép / trạng thái (không phải HH:MM).
 * Dùng chung: dropdown điểm danh, thời vụ, gợi ý modal, lọc bù công.
 * Khi thêm loại mới: cập nhật mảng này + getAttendanceComboFlags (attendanceComboStats.js).
 */

export const ATTENDANCE_GIO_VAO_TYPE_OPTIONS = [
  { value: "Có đi làm", shortLabel: "Có" },
  { value: "Vào trễ", shortLabel: "Vào trễ" },
  { value: "Phép năm", shortLabel: "PN" },
  { value: "1/2 Phép năm", shortLabel: "1/2 PN" },
  { value: "Không lương", shortLabel: "KL" },
  { value: "Không phép", shortLabel: "KP" },
  { value: "Thai sản", shortLabel: "TS" },
  { value: "Phép ốm", shortLabel: "PO" },
  { value: "Tai nạn", shortLabel: "TN" },
  { value: "Phép cưới", shortLabel: "PC" },
  { value: "Phép tang", shortLabel: "PT" },
  { value: "Dưỡng sức", shortLabel: "DS" },
  { value: "Phép công tác", shortLabel: "PCT" },
  { value: "Nghỉ việc", shortLabel: "NV" },
];

function foldGioVaoCompare(s) {
  return String(s ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
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
