import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

const HEATMAP_RGB_START = [0xee, 0xf4, 0xf0];
const HEATMAP_RGB_END = [0x1f, 0x5c, 0x4e];
const HEATMAP_INK = "#16221D";

/** @type {ReadonlyMap<string, { bg: string, text: string }>} */
const DEPT_COLORS = new Map(
  Object.entries({
    QC: { bg: "#E4F0EC", text: "#1F5C4E" },
    EHS: { bg: "#FBE9E4", text: "#B94A36" },
    Anodizing: { bg: "#EAE4F5", text: "#5A3E9E" },
    MC: { bg: "#FDEBE3", text: "#B85C2E" },
    "Assy-Komsa": { bg: "#F5E4EE", text: "#9C3E73" },
    Automation: { bg: "#E4E8F5", text: "#3E4E9C" },
    "Assy-TU": { bg: "#E4F5F0", text: "#1F8C6E" },
    Hairline: { bg: "#F5EFE4", text: "#8C6A1F" },
    "Assy-Flip": { bg: "#EAF5E4", text: "#4E8C1F" },
  }),
);

const DEFAULT_DEPT_COLOR = { bg: "#E4F0EC", text: "#1F5C4E" };

const AVATAR_FALLBACK_PALETTE = [
  "#1F5C4E",
  "#5A3E9E",
  "#3E4E9C",
  "#9C3E73",
  "#B85C2E",
  "#2E7D4F",
  "#1F8C6E",
  "#4E8C1F",
];

function lerpChannel(start, end, t) {
  return Math.round(start + (end - start) * t);
}

/** @returns {null | { backgroundColor: string, color: string }} */
export function annualLeaveHeatmapCellStyle(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;

  const t = Math.min(n / 6, 1);
  const r = lerpChannel(HEATMAP_RGB_START[0], HEATMAP_RGB_END[0], t);
  const g = lerpChannel(HEATMAP_RGB_START[1], HEATMAP_RGB_END[1], t);
  const b = lerpChannel(HEATMAP_RGB_START[2], HEATMAP_RGB_END[2], t);

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: t > 0.55 ? "#FFFFFF" : HEATMAP_INK,
  };
}

export function annualLeaveDeptPillStyle(deptName) {
  const key = String(deptName ?? "").trim();
  if (!key) return DEFAULT_DEPT_COLOR;

  if (DEPT_COLORS.has(key)) return DEPT_COLORS.get(key);

  const lower = key.toLowerCase();
  for (const [name, colors] of DEPT_COLORS) {
    if (name.toLowerCase() === lower) return colors;
  }

  return DEFAULT_DEPT_COLOR;
}

/** Lấy 2 chữ cái từ 2 từ cuối của họ tên (vd. Phạm Công Thành → CT). */
export function annualLeaveEmployeeInitials(fullName) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[parts.length - 2];
  const b = parts[parts.length - 1];
  return `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase() || "?";
}

export function annualLeaveEmployeeAvatarStyle(fullName, deptName) {
  const initials = annualLeaveEmployeeInitials(fullName);
  const deptStyle = annualLeaveDeptPillStyle(deptName);
  const deptKey = String(deptName ?? "").trim();

  if (deptKey) {
    return {
      initials,
      backgroundColor: deptStyle.text,
      color: "#FFFFFF",
    };
  }

  const key = String(fullName ?? "").trim();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % AVATAR_FALLBACK_PALETTE.length;
  }

  return {
    initials,
    backgroundColor: AVATAR_FALLBACK_PALETTE[hash],
    color: "#FFFFFF",
  };
}

/**
 * Màu cột «Còn lại»: đỏ < 1 ngày, cam 1–6, xanh > 6.
 * @returns {"neutral" | "green" | "amber" | "red"}
 */
export function resolveAnnualLeaveBalanceStatus(row) {
  const balance = Number(row?.[ANNUAL_LEAVE_EMP.BALANCE]);
  if (!Number.isFinite(balance)) return "neutral";
  if (balance < 1) return "red";
  if (balance <= 6) return "amber";
  return "green";
}
