import { useEffect, useRef, useState } from "react";
import { db, ref, onValue } from "@/services/firebase";
import {
  getIsOffDayFromRaw,
  getIsHolidayDayFromRaw,
  getIsCompensatoryDayFromRaw,
} from "./attendanceDayMeta";
import { mergeAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
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
    const unsubscribe = onValue(empRef, (snapshot) => {
      if (generation !== listenGenerationRef.current) return;

      const data = snapshot.val();
      attendanceRawRef.current = data;
      const off = getIsOffDayFromRaw(data);
      const hol = getIsHolidayDayFromRaw(data);
      const comp = getIsCompensatoryDayFromRaw(data);
      setIsOffDay(off);
      setIsHolidayDay(hol);
      setIsCompensatoryDay(comp);

      // Merge full snapshot mỗi lần — tránh kẹt danh sách cũ/rỗng sau tối ưu reconcile.
      const next = sortEmployeesStableAsc(mergeAttendanceDayRowsFromRaw(data));
      setEmployees(next);
    });

    return () => {
      unsubscribe();
    };
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
