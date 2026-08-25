import { useEffect, useRef, useState } from "react";
import { db, ref, get } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "@/hooks/firebaseGeneration";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import { countAttendanceDashboardDaySummary } from "./attendanceDashboardMetrics";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import { parseLocalDateKey } from "@/utils/dateKey";

function formatShortDayLabel(dateKey, locale = "vi-VN") {
  const d = parseLocalDateKey(dateKey);
  if (!d) return dateKey.slice(5);
  return d.toLocaleDateString(locale, { weekday: "short", day: "2-digit" });
}

/**
 * Tải 7 ngày gần nhất (tính cả selectedDate) cho biểu đồ xu hướng.
 */
export function useAttendanceDashboardWeek(
  attendanceRootPath,
  selectedDate,
  locale = "vi-VN",
) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    if (!attendanceRootPath || !selectedDate) {
      setPoints([]);
      setLoading(false);
      return undefined;
    }

    const myGeneration = bumpFirebaseGeneration(fetchGenerationRef);
    const keys = [];
    for (let i = 6; i >= 0; i -= 1) {
      keys.push(getDateKeyBySubtractDays(selectedDate, i));
    }

    setLoading(true);
    setPoints([]);

    void Promise.all(
      keys.map(async (dateKey) => {
        const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
        if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) {
          return null;
        }
        const raw = snap.val();
        const employees = reconcileAttendanceDayRowsFromRaw([], raw, {
          seasonal: attendanceRootPath === "seasonalAttendance",
        });
        const summary = countAttendanceDashboardDaySummary(employees);
        return {
          dateKey,
          label: formatShortDayLabel(dateKey, locale),
          ...summary,
        };
      }),
    )
      .then((rows) => {
        if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
        setPoints(rows.filter(Boolean));
      })
      .finally(() => {
        if (isFirebaseGenerationStale(myGeneration, fetchGenerationRef)) return;
        setLoading(false);
      });

    return undefined;
  }, [attendanceRootPath, selectedDate, locale]);

  return { weekPoints: points, weekLoading: loading };
}
