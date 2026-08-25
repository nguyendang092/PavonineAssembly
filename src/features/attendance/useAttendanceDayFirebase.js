import { useEffect, useRef, useState, startTransition } from "react";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
import {
  getIsOffDayFromRaw,
  getIsHolidayDayFromRaw,
  getIsCompensatoryDayFromRaw,
} from "./attendanceDayMeta";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";

/**
 * Đồng bộ `attendanceRootPath/{selectedDate}` — tách listener khỏi AttendanceList.
 */
export function useAttendanceDayFirebase(attendanceRootPath, selectedDate) {
  const [employees, setEmployees] = useState([]);
  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const [isCompensatoryDay, setIsCompensatoryDay] = useState(false);

  const attendanceRawRef = useRef(undefined);
  const employeesRef = useRef([]);

  const dayPath =
    selectedDate && attendanceRootPath
      ? `${attendanceRootPath}/${selectedDate}`
      : null;
  const { data: attendanceRaw, loading } = useFirebaseValue(dayPath);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    attendanceRawRef.current = undefined;
    setEmployees([]);
    setIsOffDay(false);
    setIsHolidayDay(false);
    setIsCompensatoryDay(false);
  }, [selectedDate, attendanceRootPath]);

  useEffect(() => {
    if (loading) return;

    const data = attendanceRaw;
    attendanceRawRef.current = data;
    const seasonal = isSeasonalAttendanceRoot(attendanceRootPath);

    startTransition(() => {
      setIsOffDay(getIsOffDayFromRaw(data));
      setIsHolidayDay(getIsHolidayDayFromRaw(data));
      setIsCompensatoryDay(getIsCompensatoryDayFromRaw(data));
      setEmployees((prev) =>
        reconcileAttendanceDayRowsFromRaw(prev, data, { seasonal }),
      );
    });
  }, [attendanceRaw, loading, attendanceRootPath]);

  return {
    employees,
    employeesRef,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
  };
}
