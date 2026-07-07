import { useEffect, useRef } from "react";
import { db } from "@/services/firebase";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { persistAnnualLeaveYearFromAttendance } from "@/features/leave/annualLeaveAttendanceSync";
import {
  getAttendanceYearSnapshot,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";

const PERSIST_DEBOUNCE_MS = 2000;

/**
 * Ghi Firebase `annualLeave/{year}` khi mở màn + khi điểm danh thay đổi (debounce).
 * Hiển thị dùng `useAnnualLeaveLiveData` — không cần chờ bước này.
 */
export function useAnnualLeaveYearReconcile({
  attendanceRootPath = "attendance",
  year,
  userEmail = "",
  enabled = true,
}) {
  const persistTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled || shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath)) return;
    if (!year || !Number.isFinite(Number(year))) return;

    const runPersist = () => {
      const attendanceOverride = getAttendanceYearSnapshot(
        attendanceRootPath,
        year,
      );
      persistAnnualLeaveYearFromAttendance(db, {
        year,
        attendanceRootPath,
        updatedBy: userEmail,
        attendanceRootOverride: attendanceOverride,
      }).catch((err) => {
        console.error("annualLeave year persist failed:", err);
      });
    };

    runPersist();

    const schedulePersist = () => {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(runPersist, PERSIST_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeAttendanceYear(
      attendanceRootPath,
      year,
      schedulePersist,
    );

    return () => {
      unsubscribe();
      clearTimeout(persistTimerRef.current);
    };
  }, [attendanceRootPath, year, userEmail, enabled]);
}
