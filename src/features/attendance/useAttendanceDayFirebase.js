import { useEffect, useRef, useState, startTransition } from "react";
import { db, ref, onValue } from "@/services/firebase";
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
  const listenGenerationRef = useRef(0);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    const generation = ++listenGenerationRef.current;
    attendanceRawRef.current = undefined;
    setEmployees([]);
    setIsOffDay(false);
    setIsHolidayDay(false);
    setIsCompensatoryDay(false);

    const empRef = ref(db, `${attendanceRootPath}/${selectedDate}`);
    const seasonal = isSeasonalAttendanceRoot(attendanceRootPath);
    const unsubscribe = onValue(empRef, (snapshot) => {
      if (generation !== listenGenerationRef.current) return;

      const data = snapshot.val();
      attendanceRawRef.current = data;

      startTransition(() => {
        setIsOffDay(getIsOffDayFromRaw(data));
        setIsHolidayDay(getIsHolidayDayFromRaw(data));
        setIsCompensatoryDay(getIsCompensatoryDayFromRaw(data));
        setEmployees((prev) =>
          reconcileAttendanceDayRowsFromRaw(prev, data, { seasonal }),
        );
      });
    });

    return () => {
      unsubscribe();
    };
  }, [selectedDate, attendanceRootPath]);

  return {
    employees,
    employeesRef,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
  };
}
