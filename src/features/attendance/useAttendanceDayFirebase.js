import { useEffect, useRef, useState } from "react";
import { db, ref, onValue } from "@/services/firebase";
import {
  getIsOffDayFromRaw,
  getIsHolidayDayFromRaw,
  getIsCompensatoryDayFromRaw,
} from "./attendanceDayMeta";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import { sortEmployeesStableAsc } from "./attendanceListSort";

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

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    attendanceRawRef.current = undefined;
    setEmployees([]);
    const empRef = ref(db, `${attendanceRootPath}/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      attendanceRawRef.current = data;
      const off = getIsOffDayFromRaw(data);
      const hol = getIsHolidayDayFromRaw(data);
      const comp = getIsCompensatoryDayFromRaw(data);
      setIsOffDay((prev) => (prev === off ? prev : off));
      setIsHolidayDay((prev) => (prev === hol ? prev : hol));
      setIsCompensatoryDay((prev) => (prev === comp ? prev : comp));
      setEmployees((prev) => {
        const next = sortEmployeesStableAsc(
          reconcileAttendanceDayRowsFromRaw(prev, data),
        );
        if (
          next === prev ||
          (prev.length === next.length &&
            prev.every((row, i) => row === next[i]))
        ) {
          return prev;
        }
        return next;
      });
    });
    return () => unsubscribe();
  }, [selectedDate, attendanceRootPath]);

  return {
    employees,
    setEmployees,
    employeesRef,
    attendanceRawRef,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
  };
}
