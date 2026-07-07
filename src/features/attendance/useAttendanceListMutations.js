import { useCallback } from "react";
import { db, ref, remove } from "@/services/firebase";
import {
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  isAdminAccess,
} from "@/config/authRoles";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "./attendanceSeasonalStt";
import {
  persistAnnualLeaveYearFromAttendance,
} from "@/features/leave/annualLeaveAttendanceSync";
import { annualLeaveYearFromDateKey } from "@/features/leave/annualLeaveBalanceLookup";

export function useAttendanceListMutations({
  user,
  userRole,
  userDepartments,
  selectedDate,
  attendanceRootPath,
  employeesRef,
  employeesLength,
  setAlert,
  t,
}) {
  const handleDelete = useCallback(
    async (id) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.pleaseLogin"),
        });
        return;
      }
      const emp = employeesRef.current.find((e) => e.id === id);
      if (!emp || !canDeleteEmployeeData(user, userRole)) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      if (
        !canEditAttendanceForEmployee({
          user,
          userRole,
          userDepartments,
          employee: emp,
        })
      ) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      if (!window.confirm(t("attendanceList.deleteConfirm"))) return;

      try {
        await remove(ref(db, `${attendanceRootPath}/${selectedDate}/${id}`));
        if (!shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath)) {
          const year = annualLeaveYearFromDateKey(selectedDate);
          await persistAnnualLeaveYearFromAttendance(db, {
            year,
            attendanceRootPath,
            updatedBy: user?.email ?? "",
          });
        }
        setAlert({
          show: true,
          type: "success",
          message: t("attendanceList.deleteSuccess", {
            component: "attendance",
          }),
        });
      } catch {
        setAlert({
          show: true,
          type: "error",
          message: t("common.deleteFail"),
        });
      }
    },
    [
      user,
      userRole,
      userDepartments,
      selectedDate,
      t,
      attendanceRootPath,
      employeesRef,
      setAlert,
    ],
  );

  const handleDeleteAllData = useCallback(async () => {
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.pleaseLogin"),
      });
      return;
    }
    if (!isAdminAccess(user, userRole)) {
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.adminOrHROnly"),
      });
      return;
    }
    const confirmMessage = t("attendanceList.deleteAllConfirm", {
      date: selectedDate,
      count: employeesLength,
    });
    if (!window.confirm(confirmMessage)) return;
    const finalConfirm = t("attendanceList.deleteAllConfirm2");
    const userInput = window.prompt(finalConfirm);
    if (userInput !== "XOA") {
      setAlert({
        show: true,
        type: "info",
        message: t("attendanceList.cancelDelete"),
      });
      return;
    }
    try {
      if (!shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath)) {
        const year = annualLeaveYearFromDateKey(selectedDate);
        await persistAnnualLeaveYearFromAttendance(db, {
          year,
          attendanceRootPath,
          updatedBy: user?.email ?? "",
        });
      }
      await remove(ref(db, `${attendanceRootPath}/${selectedDate}`));
      setAlert({
        show: true,
        type: "success",
        message: t("attendanceList.deleteAllSuccess", {
          count: employeesLength,
          date: selectedDate,
        }),
      });
    } catch (err) {
      console.error("Delete all data error:", err);
      setAlert({
        show: true,
        type: "error",
        message: t("attendanceList.deleteAllError", {
          error: err?.message || t("attendanceList.tryAgain"),
        }),
      });
    }
  }, [
    user,
    userRole,
    selectedDate,
    employeesLength,
    t,
    attendanceRootPath,
    setAlert,
  ]);

  return { handleDelete, handleDeleteAllData };
}
