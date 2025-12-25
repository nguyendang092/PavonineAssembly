import React, { useEffect, useState } from "react";
import AttendanceDashboard, {
  PRODUCTION_DEPARTMENTS,
} from "./AttendanceDashboard";
import { useUser } from "./UserContext";
import { db, ref, onValue } from "./firebase";

const AttendanceDashboardContainer = () => {
  const { user } = useUser();
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) => ({ id, ...emp }));
        arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
        setEmployees(arr);
      } else {
        setEmployees([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  return (
    <AttendanceDashboard
      employees={employees}
      globalFilter={globalFilter}
      user={user}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      loading={loading}
      setGlobalFilter={setGlobalFilter}
      departmentFilter={departmentFilter}
      PRIORITY_DEPARTMENTS={PRODUCTION_DEPARTMENTS}
    />
  );
};

export default AttendanceDashboardContainer;
