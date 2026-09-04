import { useCallback, useEffect } from "react";
import {
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  ROLES,
} from "@/config/authRoles";
import { useAttendanceColumnPlan } from "./useAttendanceBirthDeptColumns";

/**
 * Quyền, cột bảng, đồng bộ ?date= và ?edit=.
 */
export function useAttendanceListSetup({
  user,
  userRole,
  userDepartments,
  searchParams,
  setSearchParams,
  employees,
  handleEdit,
}) {
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
