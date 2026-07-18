import { useCallback, useEffect } from "react";
import {
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  ROLES,
} from "@/config/authRoles";
import { useAttendanceColumnPlan } from "./useAttendanceBirthDeptColumns";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";

/**
 * Quyền, cột bảng, đồng bộ ?date= và ?edit=.
 */
export function useAttendanceListSetup({
  user,
  userRole,
  userDepartments,
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
  };
}
