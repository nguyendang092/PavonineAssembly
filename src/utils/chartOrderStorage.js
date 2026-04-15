/**
 * Thứ tự biểu đồ (kéo-thả):
 * - User đã đăng nhập (có email): Firebase Realtime DB `userPreferences/{safeEmail}/chartOrder_v1/{kind}`.
 *   (`safeEmail` — không chứa `. # $ [ ]`, vì RTDB cấm trong path.)
 * - Không email (`anonymous`): chỉ localStorage (fallback khi lỗi mạng cũng ghi local).
 */

import { db, ref, get, set } from "@/services/firebase";

const STORAGE_PREFIX = "pavonine_chartOrder_v1";
const RTDB_ROOT = "userPreferences";

export const CHART_ORDER_KIND = {
  ATTENDANCE_DEPT: "attendanceDept",
  WORKPLACE_AREA: "workplaceArea",
};

/** Khóa localStorage cũ (cho phép dấu chấm trong email). */
function legacySafeUserSegment(email) {
  return String(email || "anonymous")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, "_");
}

/**
 * Segment path RTDB + khóa localStorage mới.
 * Firebase không cho `. # $ [ ]` trong path.
 */
function safeUserSegment(email) {
  return legacySafeUserSegment(email).replace(/[.#$\[\]]/g, "_");
}

function localStorageKey(email, kind) {
  const safe = safeUserSegment(email);
  return `${STORAGE_PREFIX}:${kind}:${safe}`;
}

function rtdbChartOrderPath(email, kind) {
  return `${RTDB_ROOT}/${safeUserSegment(email)}/chartOrder_v1/${kind}`;
}

function loadFromLocalStorage(email, kind) {
  try {
    const keyNew = localStorageKey(email, kind);
    let raw = localStorage.getItem(keyNew);
    if (!raw && legacySafeUserSegment(email) !== safeUserSegment(email)) {
      raw = localStorage.getItem(
        `${STORAGE_PREFIX}:${kind}:${legacySafeUserSegment(email)}`,
      );
      if (raw) {
        try {
          localStorage.setItem(keyNew, raw);
          localStorage.removeItem(
            `${STORAGE_PREFIX}:${kind}:${legacySafeUserSegment(email)}`,
          );
        } catch {
          /* ignore migration failure */
        }
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(email, kind, ids) {
  try {
    localStorage.setItem(localStorageKey(email, kind), JSON.stringify(ids));
  } catch (e) {
    console.warn("saveToLocalStorage chartOrder", e);
  }
}

function removeFromLocalStorage(email, kind) {
  try {
    localStorage.removeItem(localStorageKey(email, kind));
    localStorage.removeItem(
      `${STORAGE_PREFIX}:${kind}:${legacySafeUserSegment(email)}`,
    );
  } catch {
    /* ignore */
  }
}

/**
 * Đọc thứ tự đã lưu (ưu tiên server khi có email).
 * Lần đầu: nếu server trống mà localStorage còn dữ liệu cũ → đẩy lên server và xóa local.
 */
export async function hydrateChartOrder(userKey, kind) {
  const email = String(userKey || "anonymous").trim().toLowerCase();
  if (!email || email === "anonymous") {
    return loadFromLocalStorage("anonymous", kind);
  }
  try {
    const r = ref(db, rtdbChartOrderPath(email, kind));
    const snap = await get(r);
    if (snap.exists() && Array.isArray(snap.val())) {
      return snap.val().filter((x) => typeof x === "string");
    }
    const legacy = loadFromLocalStorage(email, kind);
    if (legacy.length > 0) {
      await set(r, legacy);
      removeFromLocalStorage(email, kind);
    }
    return legacy;
  } catch (e) {
    console.warn("hydrateChartOrder", e);
    return loadFromLocalStorage(email, kind);
  }
}

/**
 * Ghi thứ tự (server nếu có email; lỗi mạng → local).
 */
export async function persistChartOrder(userKey, kind, ids) {
  const email = String(userKey || "anonymous").trim().toLowerCase();
  const list = Array.isArray(ids)
    ? ids.filter((x) => typeof x === "string")
    : [];
  if (!email || email === "anonymous") {
    saveToLocalStorage("anonymous", kind, list);
    return;
  }
  try {
    await set(ref(db, rtdbChartOrderPath(email, kind)), list);
    removeFromLocalStorage(email, kind);
  } catch (e) {
    console.warn("persistChartOrder", e);
    saveToLocalStorage(email, kind, list);
  }
}

/** Kéo-thả HTML5 — MIME tránh trùng với text thường */
export const CHART_DRAG_MIME = "application/x-pavonine-chart-key";

/**
 * @param {string[]} keys — danh sách key hiện có (vd. tên bộ phận / khu vực)
 * @param {string[]} savedOrder — thứ tự đã lưu
 * @param {(a: string, b: string) => number} [restSort] — sort phần còn lại (chưa có trong savedOrder)
 */
export function applySavedKeyOrder(keys, savedOrder, restSort) {
  if (!keys?.length) return [];
  const set = new Set(keys);
  const seen = new Set();
  const out = [];
  for (const k of savedOrder) {
    if (set.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  const rest = keys.filter((k) => !seen.has(k));
  if (typeof restSort === "function") rest.sort(restSort);
  return [...out, ...rest];
}

/**
 * Hàng thống kê điểm danh theo bộ phận — phần không có trong savedOrder xếp theo total giảm dần.
 */
export function applyOrderToAttendanceRows(rows, savedOrder) {
  if (!rows?.length) return [];
  const byDept = new Map(rows.map((r) => [r.department, r]));
  const keys = rows.map((r) => r.department);
  const orderedKeys = applySavedKeyOrder(keys, savedOrder, (a, b) => {
    const ra = byDept.get(a);
    const rb = byDept.get(b);
    return (rb?.total ?? 0) - (ra?.total ?? 0);
  });
  return orderedKeys.map((k) => byDept.get(k)).filter(Boolean);
}

export function moveKeyBefore(list, fromKey, toKey) {
  if (fromKey === toKey) return list;
  const from = list.indexOf(fromKey);
  const to = list.indexOf(toKey);
  if (from < 0 || to < 0) return list;
  const next = list.filter((k) => k !== fromKey);
  const insertAt = next.indexOf(toKey);
  if (insertAt < 0) return list;
  next.splice(insertAt, 0, fromKey);
  return next;
}
