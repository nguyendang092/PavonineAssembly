import { ref, push, db } from "../services/firebase";

/** RTDB: danh sách append-only, mới nhất = key lớn nhất (push id). */
export const EMPLOYEE_PROFILE_HISTORY_PATH = "employeeProfileEditHistory";

const TRACKED_FIELDS = [
  "hoVaTen",
  "boPhan",
  "chucVu",
  "ngayVaoLam",
  "ngayNghiViec",
  "hinhThucNghiViec",
  "sdt",
  "trangThaiLamViec",
  "thaiSanTuNgay",
  "thaiSanDenNgay",
  "chuyenCan",
  "phanQuyen",
  "emailDangNhap",
];

function normVal(v) {
  if (v == null) return "";
  return String(v).trim();
}

/** So sánh snapshot trước/sau lưu employeeProfiles (chỉ các trường hồ sơ chính). */
export function diffEmployeeProfileDocs(prev = {}, next = {}) {
  const changes = [];
  for (const k of TRACKED_FIELDS) {
    const a = normVal(prev[k]);
    const b = normVal(next[k]);
    if (a !== b) changes.push({ k, a, b });
  }
  return changes;
}

/**
 * Ghi một dòng lịch sử (không throw — lỗi chỉ log console để không chặn lưu chính).
 */
export function appendEmployeeProfileHistory(entry) {
  const payload = {
    at: Date.now(),
    by: entry.by || "",
    action: entry.action,
    source: entry.source || "roster",
    profileKey: entry.profileKey || "",
    mnv: entry.mnv || "",
    hoVaTen: entry.hoVaTen || "",
  };
  if (entry.changes?.length) payload.changes = entry.changes;
  if (entry.excel) payload.excel = entry.excel;

  return push(ref(db, EMPLOYEE_PROFILE_HISTORY_PATH), payload).catch((err) => {
    console.error("appendEmployeeProfileHistory", err);
  });
}
