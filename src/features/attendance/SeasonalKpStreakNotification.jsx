import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationBell from "@/components/ui/NotificationBell";
import { db, ref, get } from "@/services/firebase";
import { getDateKeyBySubtractDays, parseLocalDateKey } from "@/utils/dateKey";
import { sanitizeAttendanceDayNodeForUi } from "@/utils/employeeRosterRecord";
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

/** Chủ nhật bị loại khỏi chuỗi KP (không tính, cũng không phá streak). */
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

  /** Chủ nhật bị loại khỏi chuỗi: ngày đang chọn là CN ⇒ không hiển thị. */
  if (isSundayDateKey(selectedDate)) return [];

  const kpToday = filteredEmployees.filter((e) =>
    isAttendanceLeaveTypeKhongPhep(leaveRawForStreakFromEmployee(e)),
  );
  if (kpToday.length === 0) return [];

  const streak = new Map();
  let active = new Set();
  for (const e of kpToday) {
    active.add(e.id);
    streak.set(e.id, 1);
  }

  for (
    let offset = 1;
    offset <= MAX_KP_STREAK_LOOKBACK_DAYS && active.size > 0;
    offset++
  ) {
    const dateKey = getDateKeyBySubtractDays(selectedDate, offset);
    /** Bỏ qua Chủ nhật: không fetch, không tăng streak, không phá streak — chỉ lùi tiếp. */
    if (isSundayDateKey(dateKey)) continue;
    const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
    const raw = snap.exists() ? snap.val() : null;
    const next = new Set();
    for (const id of active) {
      const node = raw?.[id];
      if (
        node != null &&
        typeof node === "object" &&
        isAttendanceLeaveTypeKhongPhep(leaveRawForStreakFromDayNode(node, id))
      ) {
        streak.set(id, (streak.get(id) ?? 1) + 1);
        next.add(id);
      }
    }
    active = next;
  }

  const out = [];
  for (const emp of kpToday) {
    const streakDays = streak.get(emp.id) ?? 1;
    if (streakDays >= 2) out.push({ emp, streakDays });
  }
  return sortStreakRowsStableAsc(out);
}

/**
 * Điểm danh thời vụ: thay cho danh sách «bù công» — báo NV có loại phép KP
 * liên tiếp từ ≥2 ngày (tính cả ngày điểm danh đang chọn).
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
                    key={emp.id}
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
