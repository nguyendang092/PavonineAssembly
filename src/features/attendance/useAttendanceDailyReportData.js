import { useEffect, useState } from "react";
import { db, ref, get } from "@/services/firebase";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import {
  getIsCompensatoryDayFromRaw,
  getIsHolidayDayFromRaw,
  getIsOffDayFromRaw,
} from "./attendanceDayMeta";

async function fetchAttendanceDayEmployees(attendanceRootPath, dateKey) {
  const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
  const raw = snap.val();
  const employees = reconcileAttendanceDayRowsFromRaw([], raw, {
    seasonal: attendanceRootPath === "seasonalAttendance",
  });
  return { raw, employees };
}

/**
 * Tải điểm danh ngày — cả 정규직 (`attendance`) và 일용직 (`seasonalAttendance`).
 */
export function useAttendanceDailyReportData(dateKey) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regularEmployees, setRegularEmployees] = useState([]);
  const [seasonalEmployees, setSeasonalEmployees] = useState([]);
  const [dayMeta, setDayMeta] = useState({
    isOffDay: false,
    isHolidayDay: false,
    isCompensatoryDay: false,
  });

  useEffect(() => {
    if (!dateKey) {
      setRegularEmployees([]);
      setSeasonalEmployees([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const [regular, seasonal] = await Promise.all([
          fetchAttendanceDayEmployees("attendance", dateKey),
          fetchAttendanceDayEmployees("seasonalAttendance", dateKey),
        ]);
        if (cancelled) return;

        setRegularEmployees(regular.employees);
        setSeasonalEmployees(seasonal.employees);
        setDayMeta({
          isOffDay: getIsOffDayFromRaw(regular.raw),
          isHolidayDay: getIsHolidayDayFromRaw(regular.raw),
          isCompensatoryDay: getIsCompensatoryDayFromRaw(regular.raw),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setRegularEmployees([]);
          setSeasonalEmployees([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  return {
    loading,
    error,
    regularEmployees,
    seasonalEmployees,
    dayMeta,
  };
}
