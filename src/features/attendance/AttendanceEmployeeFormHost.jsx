import React, { memo, lazy, Suspense, useCallback } from "react";
import {
  useAttendanceListContentBranch,
  useAttendanceListEmployeeModalBranch,
} from "./attendanceListBranchContexts";
import { loadAttendanceEmployeeFormModal } from "./loadAttendanceEmployeeFormModal";

const AttendanceEmployeeFormModal = lazy(loadAttendanceEmployeeFormModal);

function EmployeeFormSuspenseFallback({ zIndex }) {
  return (
    <div
      className="fixed inset-0 bg-black/45"
      style={{ zIndex }}
      aria-busy="true"
    />
  );
}

function AttendanceEmployeeFormHost() {
  const {
    showEmployeeModal,
    employeeModalRecord,
    setShowEmployeeModal,
    setEmployeeModalRecord,
  } = useAttendanceListEmployeeModalBranch();
  const {
    selectedDate,
    employees,
    user,
    userRole,
    userDepartments,
    attendanceRootPath,
    setAlert,
    isCompensatoryDay,
    isOffDay,
    isHolidayDay,
    showComboChartModal,
  } = useAttendanceListContentBranch();

  const closeEmployeeModal = useCallback(() => {
    setShowEmployeeModal(false);
    setEmployeeModalRecord(null);
  }, [setShowEmployeeModal, setEmployeeModalRecord]);

  if (!showEmployeeModal) return null;

  const overlayZIndex = showComboChartModal
    ? "calc(var(--z-modal-content, 1210) + 50)"
    : "var(--z-modal-backdrop, 1200)";

  return (
    <Suspense fallback={<EmployeeFormSuspenseFallback zIndex={overlayZIndex} />}>
      <AttendanceEmployeeFormModal
        open
        onClose={closeEmployeeModal}
        initialRecord={employeeModalRecord}
        selectedDate={selectedDate}
        employees={employees}
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        attendanceRootPath={attendanceRootPath}
        onAlert={setAlert}
        dayIsCompensatory={isCompensatoryDay}
        dayIsOffDay={isOffDay}
        dayIsHolidayDay={isHolidayDay}
        overlayZIndex={overlayZIndex}
      />
    </Suspense>
  );
}

export default memo(AttendanceEmployeeFormHost);
