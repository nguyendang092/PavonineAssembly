import { useCallback, useEffect, useMemo } from "react";
import {
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  ROLES,
} from "@/config/authRoles";
import { getAttendanceGridTemplateColumns } from "./AttendanceTableRow";
import { useAttendanceColumnPlan } from "./useAttendanceBirthDeptColumns";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";

/**
 * Quyền, cột bảng, alert auto-hide, đồng bộ ?date= và ?edit=.
 */
export function useAttendanceListSetup({
  user,
  userRole,
  userDepartments,
  alert,
  setAlert,
  searchParams,
  setSearchParams,
  setSelectedDate,
  employees,
  handleEdit,
}) {
  useEffect(() => {
    const d = searchParams.get("date");
    if (d && ISO_DATE_KEY_RE.test(d)) setSelectedDate(d);
  }, [searchParams, setSelectedDate]);

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert((a) => ({ ...a, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [alert.show, setAlert]);

  const canEditEmployee = useCallback(
    (employee) =>
      canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

  const showRowModalActions = Boolean(
    user && userRole && userRole !== ROLES.STAFF,
  );

  const canDeleteDayRecord = canDeleteEmployeeData(user, userRole);

  const columnPlan = useAttendanceColumnPlan();

  const attendanceGridTemplateColumns = useMemo(
    () => getAttendanceGridTemplateColumns(showRowModalActions, columnPlan),
    [showRowModalActions, columnPlan],
  );

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !user) return;
    if (employees.length === 0) return;

    const emp = employees.find((e) => String(e.id) === String(editId));

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      },
      { replace: true },
    );

    if (emp) handleEdit(emp);
  }, [searchParams, employees, user, handleEdit, setSearchParams]);

  return {
    canEditEmployee,
    showRowModalActions,
    canDeleteDayRecord,
    columnPlan,
    attendanceGridTemplateColumns,
  };
}
