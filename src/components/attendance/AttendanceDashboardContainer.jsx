import React, { useEffect, useState } from "react";
import AttendanceHeadcountDashboard from "./AttendanceHeadcountDashboard";
import { useUser } from "../../contexts/UserContext";
import { db, ref, onValue, set } from "../../services/firebase";
import {
  EMPLOYEE_PROFILES_PATH,
  mergeEmployeeProfileAndDay,
  employeeProfileStorageKeyFromMnv,
  businessEmployeeCode,
} from "../../utils/employeeRosterRecord";

const toSortedEmployeeArray = (data, profileMap) => {
  if (!data || typeof data !== "object") return [];

  const arr = Object.entries(data).map(([id, emp]) => {
    const pk = employeeProfileStorageKeyFromMnv(businessEmployeeCode(emp));
    const prof = pk && profileMap ? profileMap[pk] : null;
    return mergeEmployeeProfileAndDay({ ...emp, id }, prof, null);
  });
  arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
  return arr;
};

const AttendanceDashboardContainer = () => {
  const { user } = useUser();
  const [employees, setEmployees] = useState([]);
  const [seasonalEmployees, setSeasonalEmployees] = useState([]);
  const [requiredByDepartment, setRequiredByDepartment] = useState({});
  const [notesByKey, setNotesByKey] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState({});

  const canEditRequired =
    user?.email === "admin@gmail.com" || user?.email === "hr@pavonine.net";

  useEffect(() => {
    const unsubProf = onValue(ref(db, EMPLOYEE_PROFILES_PATH), (snapshot) => {
      const v = snapshot.val();
      setProfileMap(v && typeof v === "object" ? v : {});
    });
    return () => unsubProf();
  }, []);

  useEffect(() => {
    setLoading(true);
    const empRef = ref(db, `attendance/${selectedDate}`);
    const seasonalRef = ref(db, `seasonalAttendance/${selectedDate}`);
    const requiredRef = ref(db, `attendanceHeadcountRequired/${selectedDate}`);
    const notesRef = ref(db, `attendanceHeadcountNotes/${selectedDate}`);

    let regularLoaded = false;
    let seasonalLoaded = false;
    let requiredLoaded = false;
    let notesLoaded = false;

    const handleLoaded = () => {
      if (regularLoaded && seasonalLoaded && requiredLoaded && notesLoaded) {
        setLoading(false);
      }
    };

    const unsubscribe = onValue(empRef, (snapshot) => {
      setEmployees(toSortedEmployeeArray(snapshot.val(), profileMap));
      regularLoaded = true;
      handleLoaded();
    });

    const unsubscribeSeasonal = onValue(seasonalRef, (snapshot) => {
      setSeasonalEmployees(toSortedEmployeeArray(snapshot.val()));
      seasonalLoaded = true;
      handleLoaded();
    });

    const unsubscribeRequired = onValue(requiredRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        setRequiredByDepartment(data);
      } else {
        setRequiredByDepartment({});
      }
      requiredLoaded = true;
      handleLoaded();
    });

    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        setNotesByKey(data);
      } else {
        setNotesByKey({});
      }
      notesLoaded = true;
      handleLoaded();
    });

    return () => {
      unsubscribe();
      unsubscribeSeasonal();
      unsubscribeRequired();
      unsubscribeNotes();
    };
  }, [selectedDate, profileMap]);

  const handleRequiredChange = async (departmentKey, value) => {
    if (!canEditRequired) return;
    if (!departmentKey) return;

    const normalizedValue = Number.isFinite(value) && value >= 0 ? value : 0;

    setRequiredByDepartment((prev) => ({
      ...prev,
      [departmentKey]: normalizedValue,
    }));

    await set(
      ref(db, `attendanceHeadcountRequired/${selectedDate}/${departmentKey}`),
      normalizedValue,
    );
  };

  const handleNoteChange = async (noteKey, value) => {
    if (!canEditRequired) return;
    if (!noteKey) return;

    const normalizedValue = String(value || "").trim();

    setNotesByKey((prev) => ({
      ...prev,
      [noteKey]: normalizedValue,
    }));

    await set(
      ref(db, `attendanceHeadcountNotes/${selectedDate}/${noteKey}`),
      normalizedValue,
    );
  };

  return (
    <AttendanceHeadcountDashboard
      employees={employees}
      seasonalEmployees={seasonalEmployees}
      requiredByDepartment={requiredByDepartment}
      onRequiredChange={handleRequiredChange}
      notesByKey={notesByKey}
      onNoteChange={handleNoteChange}
      canEditRequired={canEditRequired}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      loading={loading}
    />
  );
};

export default AttendanceDashboardContainer;
