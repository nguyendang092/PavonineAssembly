import { useCallback } from "react";
import { db, ref, remove, update, get } from "@/services/firebase";
import {
  canEditAttendanceForEmployee,
  canDeleteEmployeeData,
  isAdminAccess,
} from "@/config/authRoles";
import { shouldClientSyncAnnualLeaveForAttendanceRoot } from "@/config/annualLeaveClientSync";
import { syncAnnualLeaveAfterAttendanceDayChange } from "@/features/leave/annualLeaveClientDaySync";
import { buildAttendanceDeleteAllEmployeesFirebaseUpdates } from "@/features/attendance/attendanceDayMeta";

function attendanceRawFromListRow(row) {
  if (!row || typeof row !== "object") return {};
  const raw = { ...row };
  delete raw.firebaseKey;
  return raw;
}

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
        const clientSync = shouldClientSyncAnnualLeaveForAttendanceRoot(
          attendanceRootPath,
        );
        if (clientSync) {
          await syncAnnualLeaveAfterAttendanceDayChange(db, {
            dateKey: selectedDate,
            attendanceRootPath,
            previousDayData: {
              [id]: attendanceRawFromListRow(emp),
            },
            nextDayData: {},
            scopeEmpKeySet: new Set([id]),
            updatedBy: user?.email ?? "",
          });
        }
        await remove(ref(db, `${attendanceRootPath}/${selectedDate}/${id}`));
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
      const dayRef = ref(db, `${attendanceRootPath}/${selectedDate}`);
      const daySnap = await get(dayRef);
      const dayData = daySnap.val() || {};
      const clientSync = shouldClientSyncAnnualLeaveForAttendanceRoot(
        attendanceRootPath,
      );
      if (clientSync) {
        const previousDayData = Object.fromEntries(
          employeesRef.current.map((row) => [
            row.id,
            attendanceRawFromListRow(row),
          ]),
        );
        await syncAnnualLeaveAfterAttendanceDayChange(db, {
          dateKey: selectedDate,
          attendanceRootPath,
          previousDayData,
          nextDayData: {},
          scopeEmpKeySet: new Set(Object.keys(previousDayData)),
          updatedBy: user?.email ?? "",
        });
      }
      const updates = buildAttendanceDeleteAllEmployeesFirebaseUpdates(
        attendanceRootPath,
        selectedDate,
        dayData,
      );
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
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
    employeesRef,
    setAlert,
  ]);

  return { handleDelete, handleDeleteAllData };
}
