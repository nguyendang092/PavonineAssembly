import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationBell from "@/components/ui/NotificationBell";
import { db, ref, get } from "@/services/firebase";
import { getDateKeyBySubtractDays, parseLocalDateKey } from "@/utils/dateKey";
import {
  attendanceMnvStorageKey,
  sanitizeAttendanceDayNodeForUi,
} from "@/utils/attendanceEmployeeRecord";
import { isAttendanceDayMetaKey } from "./attendanceDayMeta";
import {
  applyLegacyGioVaoLeaveMigration,
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeColorClassName,
  getAttendanceLeaveTypeRaw,
  isAttendanceLeaveTypeKhongPhep,
} from "./attendanceGioVaoTypeOptions";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";

const MAX_KP_STREAK_LOOKBACK_DAYS = 90;

/**
 * Chủ nhật không tham gia chuỗi KP: không đọc Firebase, không cộng ngày, không làm mất nhịp —
 * ví dụ T7 (9) + T2 (11) vẫn nối được khi đang xem T2, bỏ qua CN (10).
 */
function isSundayDateKey(dateKey) {
  const d = parseLocalDateKey(dateKey);
  return Boolean(d) && d.getDay() === 0;
}

function leaveRawForStreakFromEmployee(emp) {
  return getAttendanceLeaveTypeRaw(
    applyLegacyGioVaoLeaveMigration(emp ?? {}),
  );
}

function leaveRawForStreakFromDayNode(node, id) {
  return getAttendanceLeaveTypeRaw(
    applyLegacyGioVaoLeaveMigration(
      sanitizeAttendanceDayNodeForUi(node ?? {}, id),
    ),
  );
}

/**
 * Khóa ổn định theo MNV để nối chuỗi KP giữa các ngày (id Firebase push có thể đổi).
 * Không có MNV: fallback businessId, rồi `__fb:{id}`.
 */
function streakKeyForKpEmp(emp) {
  if (emp == null || typeof emp !== "object") return "__fb:unknown";
  const m = attendanceMnvStorageKey(emp.mnv);
  if (m) return m.toLowerCase();
  const bid = attendanceMnvStorageKey(emp.businessId);
  if (bid) return `bid:${bid.toLowerCase()}`;
  const id = String(emp.id ?? "").trim();
  return id ? `__fb:${id}` : "__fb:unknown";
}

/** Mã dùng để ghép dòng cùng nhân viên trên snapshot một ngày. */
function attendanceMatchCodesFromEmp(emp) {
  const codes = new Set();
  if (emp == null || typeof emp !== "object") return codes;
  for (const raw of [emp.mnv, emp.mvt, emp.businessId]) {
    const c = attendanceMnvStorageKey(raw);
    if (c) codes.add(c.toLowerCase());
  }
  return codes;
}

/**
 * Tìm node nhân viên trên `raw` theo MNV/MVT/businessId (không dùng key Firebase).
 * Nhiều dòng trùng mã: ưu tiên trùng họ tên; không chắc → null.
 * @returns {{ node: object, firebaseKey: string } | null}
 */
function findDayNodeOnRawForEmp(raw, empToday) {
  if (!raw || typeof raw !== "object" || empToday == null) return null;
  const want = attendanceMatchCodesFromEmp(empToday);
  if (want.size === 0) return null;
  const nameNorm = (v) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const nameT = nameNorm(empToday?.hoVaTen);
  const matches = [];
  for (const [entryKey, node] of Object.entries(raw)) {
    if (isAttendanceDayMetaKey(entryKey)) continue;
    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      continue;
    }
    const sanitized = sanitizeAttendanceDayNodeForUi(node, entryKey);
    const got = attendanceMatchCodesFromEmp(sanitized);
    let hit = false;
    for (const w of want) {
      if (got.has(w)) {
        hit = true;
        break;
      }
    }
    if (hit) matches.push({ node, sanitized, entryKey });
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const m0 = matches[0];
    return { node: m0.node, firebaseKey: m0.entryKey };
  }
  if (nameT) {
    const byName = matches.filter(
      (m) => nameNorm(m.sanitized.hoVaTen) === nameT,
    );
    if (byName.length === 1) {
      const m0 = byName[0];
      return { node: m0.node, firebaseKey: m0.entryKey };
    }
  }
  return null;
}

function sortStreakRowsStableAsc(rows) {
  return [...rows].sort((a, b) => {
    const aStt = Number(a?.emp?.stt);
    const bStt = Number(b?.emp?.stt);
    const aSttNorm = Number.isFinite(aStt) ? aStt : Number.POSITIVE_INFINITY;
    const bSttNorm = Number.isFinite(bStt) ? bStt : Number.POSITIVE_INFINITY;
    return aSttNorm - bSttNorm;
  });
}

async function computeKhongPhepStreakRows({
  attendanceRootPath,
  selectedDate,
  filteredEmployees,
}) {
  if (!ISO_DATE_KEY_RE.test(String(selectedDate ?? ""))) return [];

  const kpTodayAll = filteredEmployees.filter((e) =>
    isAttendanceLeaveTypeKhongPhep(leaveRawForStreakFromEmployee(e)),
  );
  if (kpTodayAll.length === 0) return [];

  /** Một dòng / MNV (MNV là khóa chuỗi KP). */
  const kpToday = [];
  const seenStreakKey = new Set();
  for (const e of kpTodayAll) {
    const sk = streakKeyForKpEmp(e);
    if (seenStreakKey.has(sk)) continue;
    seenStreakKey.add(sk);
    kpToday.push(e);
  }

  const streak = new Map();
  const streakKeyToEmp = new Map();
  let active = new Set();
  for (const e of kpToday) {
    const sk = streakKeyForKpEmp(e);
    active.add(sk);
    streak.set(sk, 1);
    streakKeyToEmp.set(sk, e);
  }

  for (
    let offset = 1;
    offset <= MAX_KP_STREAK_LOOKBACK_DAYS && active.size > 0;
    offset++
  ) {
    const dateKey = getDateKeyBySubtractDays(selectedDate, offset);
    if (isSundayDateKey(dateKey)) {
      continue;
    }
    const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
    const raw = snap.exists() ? snap.val() : null;
    const next = new Set();
    for (const streakKey of active) {
      const empToday = streakKeyToEmp.get(streakKey);
      const hit = findDayNodeOnRawForEmp(raw, empToday);
      if (
        hit != null &&
        hit.node != null &&
        typeof hit.node === "object" &&
        isAttendanceLeaveTypeKhongPhep(
          leaveRawForStreakFromDayNode(hit.node, hit.firebaseKey),
        )
      ) {
        streak.set(streakKey, (streak.get(streakKey) ?? 1) + 1);
        next.add(streakKey);
      }
    }
    active = next;
  }

  const out = [];
  for (const emp of kpToday) {
    const sk = streakKeyForKpEmp(emp);
    const streakDays = streak.get(sk) ?? 1;
    if (streakDays >= 2) out.push({ emp, streakDays });
  }
  return sortStreakRowsStableAsc(out);
}

/**
 * Điểm danh thời vụ: thay cho danh sách «bù công» — báo NV có loại phép KP
 * liên tiếp từ ≥2 ngày (tính cả ngày điểm danh đang chọn). Chủ nhật bị bỏ qua
 * khi lùi ngày (không ngắt chuỗi giữa thứ Bảy và thứ Hai).
 */
export default function SeasonalKpStreakNotification({
  filteredEmployees,
  selectedDate,
  attendanceRootPath,
}) {
  const { t } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const requestGen = useRef(0);

  useEffect(() => {
    const gen = ++requestGen.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setRows([]);
      try {
        const next = await computeKhongPhepStreakRows({
          attendanceRootPath,
          selectedDate,
          filteredEmployees,
        });
        if (cancelled || gen !== requestGen.current) return;
        setRows(next);
      } catch {
        if (cancelled || gen !== requestGen.current) return;
        setRows([]);
      } finally {
        if (!cancelled && gen === requestGen.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredEmployees, selectedDate, attendanceRootPath]);

  const title = tl(
    "seasonalKpStreakTitle",
    "NHÂN VIÊN KP (≥2 NGÀY LIÊN TIẾP)",
  );
  const emptyText = tl(
    "seasonalKpStreakEmpty",
    "Không có nhân viên nào ghi KP từ 2 ngày trở lên (kể cả ngày đang chọn).",
  );
  const colStreak = tl("seasonalKpStreakColDays", "Ngày KP liên tiếp");

  return (
    <div className="hidden shrink-0 overflow-visible sm:block">
      <NotificationBell
        inline
        title={title}
        count={loading ? 0 : rows.length}
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#888",
              fontSize: 14,
              padding: 20,
            }}
          >
            {tl("seasonalKpStreakLoading", "Đang tải…")}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#888",
              fontSize: 14,
              padding: 20,
            }}
          >
            {emptyText}
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflow: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 640,
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  background: "#fde8e8",
                  zIndex: 1,
                }}
              >
                <tr>
                  <th style={{ padding: 8 }}>{colStreak}</th>
                  <th style={{ padding: 8 }}>{tl("colIndex", "STT")}</th>
                  <th style={{ padding: 8 }}>{tl("colCode", "MNV")}</th>
                  <th style={{ padding: 8 }}>{tl("colName", "Họ và tên")}</th>
                  <th style={{ padding: 8 }}>
                    {tl("colDepartment", "Bộ phận")}
                  </th>
                  <th style={{ padding: 8 }}>
                    {tl("colTimeIn", "Giờ vào")}
                  </th>
                  <th style={{ padding: 8 }}>
                    {tl("colLeaveType", "Loại phép")}
                  </th>
                  <th style={{ padding: 8 }}>{tl("colTimeOut", "Giờ ra")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ emp, streakDays }, idx) => (
                  <tr
                    key={streakKeyForKpEmp(emp)}
                    style={{
                      background: idx % 2 === 0 ? "#fef2f2" : "#fff",
                    }}
                  >
                    <td
                      style={{
                        textAlign: "center",
                        padding: 8,
                        fontWeight: 800,
                        color: "#b91c1c",
                      }}
                    >
                      {streakDays}
                    </td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      {idx + 1}
                    </td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      {emp.mnv}
                    </td>
                    <td style={{ padding: 8 }}>{emp.hoVaTen}</td>
                    <td style={{ padding: 8 }}>{emp.boPhan}</td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      {formatAttendanceTimeInColumnDisplay(emp.gioVao)}
                    </td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      <span
                        className={`font-semibold ${getAttendanceLeaveTypeColorClassName(
                          getAttendanceLeaveTypeRaw(emp),
                        )}`}
                      >
                        {formatAttendanceLeaveTypeColumnForEmployee(emp)}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      {emp.gioRa || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NotificationBell>
    </div>
  );
}
