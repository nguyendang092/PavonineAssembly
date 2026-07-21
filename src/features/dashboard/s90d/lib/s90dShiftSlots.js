/** Khung giờ ca sản xuất S90D (theo mẫu Excel). */
export const S90D_SHIFT_SLOTS = Object.freeze([
  "08~10",
  "10~12",
  "13~15",
  "15~17",
  "17~20",
  "20~22",
  "22~24",
  "00~03",
  "03~05",
  "05~08",
]);

/** Map ca cũ → ca mới khi đọc dữ liệu Firebase/localStorage. */
export const S90D_LEGACY_SHIFT_SLOT_MAP = Object.freeze({
  "17~19": "17~20",
  "19~21": "17~20",
  "21~23": "22~24",
  "23~01": "00~03",
  "01~03": "00~03",
  "20~24": "20~22",
});

const SLOT_SET = new Set(S90D_SHIFT_SLOTS);

export function resolveShiftSlotKey(shiftSlot) {
  const key = String(shiftSlot ?? "").trim();
  if (SLOT_SET.has(key)) return key;
  return S90D_LEGACY_SHIFT_SLOT_MAP[key] ?? key;
}

/** Chuẩn hóa `WorkingLight` từ Firebase → mã ca trên báo cáo. */
export function normalizeShiftSlot(workingLight) {
  const key = String(workingLight ?? "").trim();
  const resolved = resolveShiftSlotKey(key);
  if (SLOT_SET.has(resolved)) return resolved;
  if (key === "Day") return "08~10";
  if (key === "Night") return "22~24";
  return SLOT_SET.has(key) ? key : "08~10";
}
