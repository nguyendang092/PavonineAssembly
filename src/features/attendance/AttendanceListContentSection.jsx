import React, { memo, lazy, Suspense, useCallback } from "react";
import LoadingBlock from "@/components/ui/LoadingBlock";
import AttendanceEmployeeFormModal from "./AttendanceEmployeeFormModal";
import AttendanceOffDaysModal from "./AttendanceOffDaysModal";
import AttendanceListTableSection from "./AttendanceListTableSection";
import AttendanceListSummary from "./AttendanceListSummary";
import {
  useAttendanceListContentBranch,
  useAttendanceListComboBranch,
} from "./attendanceListBranchContexts";

const AttendanceComboChartModal = lazy(
  () => import("./AttendanceComboChartModal"),
);

/**
 * Modals + biểu đồ combo + bảng + tóm tắt (một content context — tránh lệch dữ liệu bảng).
 */
function AttendanceListContentSection() {
  const {
    showEmployeeModal,
    setShowEmployeeModal,
    setEmployeeModalRecord,
    employeeModalRecord,
    selectedDate,
    setSelectedDate,
    employees,
    user,
    userRole,
    userDepartments,
    attendanceRootPath,
    setAlert,
    isCompensatoryDay,
    offDaysModalOpen,
    setOffDaysModalOpen,
    refreshMonthOffDays,
    tl,
    t,
    showComboChartModal,
    setShowComboChartModal,
    comboDashboardGroup,
    setComboDashboardGroup,
    displayLocale,
    columnPlan,
    deferredFilteredEmployees,
    showRowModalActions,
    canDeleteDayRecord,
    canEditEmployee,
    handleEdit,
    handleDelete,
    isOffDay,
    isHolidayDay,
  } = useAttendanceListContentBranch();

  const {
    comboProductionDeptCatalog,
    comboProductionDeptOrder,
    persistComboProductionDeptOrder,
    getComboProductionDeptChartRank,
    comboDashboardStats,
    comboChartData,
    comboChartBodyReady,
    comboChartRowsVisible,
    comboChartCardsVisibleCount,
    comboChartDataOrdered,
    comboStatDetailKey,
    setComboStatDetailKey,
    comboStatLabelByKey,
    comboStatEmployeesByKey,
    compareEmployeesBusy,
    handleOpenCompareEmployees,
  } = useAttendanceListComboBranch();

  const closeEmployeeModal = useCallback(() => {
    setShowEmployeeModal(false);
    setEmployeeModalRecord(null);
  }, [setShowEmployeeModal, setEmployeeModalRecord]);

  const closeOffDaysModal = useCallback(() => {
    setOffDaysModalOpen(false);
  }, [setOffDaysModalOpen]);

  const closeComboChartModal = useCallback(() => {
    setShowComboChartModal(false);
  }, [setShowComboChartModal]);

  return (
    <>
      <AttendanceEmployeeFormModal
        open={showEmployeeModal}
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
      />

      <AttendanceOffDaysModal
        open={offDaysModalOpen}
        onClose={closeOffDaysModal}
        selectedDate={selectedDate}
        user={user}
        userRole={userRole}
        tl={tl}
        onSaved={refreshMonthOffDays}
        attendanceRootPath={attendanceRootPath}
      />

      {showComboChartModal ? (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px]"
              style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
              aria-busy="true"
              aria-live="polite"
            >
              <LoadingBlock
                message={tl(
                  "comboChartLoading",
                  "Đang tải biểu đồ theo bộ phận…",
                )}
                textClassName="text-sm font-medium text-slate-100"
                className="py-0"
              />
            </div>
          }
        >
          <AttendanceComboChartModal
            open
            onClose={closeComboChartModal}
            comboDashboardGroup={comboDashboardGroup}
            setComboDashboardGroup={setComboDashboardGroup}
            comboProductionDeptCatalog={comboProductionDeptCatalog}
            comboProductionDeptOrder={comboProductionDeptOrder}
            onPersistComboProductionDeptOrder={persistComboProductionDeptOrder}
            getComboProductionDeptChartRank={getComboProductionDeptChartRank}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            tl={tl}
            t={t}
            comboDashboardStats={comboDashboardStats}
            comboChartData={comboChartData}
            comboChartBodyReady={comboChartBodyReady}
            comboChartRowsVisible={comboChartRowsVisible}
            comboChartCardsVisibleCount={comboChartCardsVisibleCount}
            comboChartDataOrdered={comboChartDataOrdered}
            comboStatDetailKey={comboStatDetailKey}
            setComboStatDetailKey={setComboStatDetailKey}
            comboStatLabelByKey={comboStatLabelByKey}
            comboStatEmployeesByKey={comboStatEmployeesByKey}
            attendanceRootPath={attendanceRootPath}
            compareEmployeesBusy={compareEmployeesBusy}
            onCompareEmployees={handleOpenCompareEmployees}
          />
        </Suspense>
      ) : null}

      <AttendanceListTableSection
        columnPlan={columnPlan}
        deferredFilteredEmployees={deferredFilteredEmployees}
        showRowModalActions={showRowModalActions}
        canDeleteDayRecord={canDeleteDayRecord}
        tl={tl}
        user={user}
        canEditEmployee={canEditEmployee}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOffDay={isOffDay}
        isHolidayDay={isHolidayDay}
        isCompensatoryDay={isCompensatoryDay}
        t={t}
        attendanceRootPath={attendanceRootPath}
        selectedDate={selectedDate}
      />

      <AttendanceListSummary
        deferredFilteredEmployees={deferredFilteredEmployees}
        employeesCount={employees.length}
        displayLocale={displayLocale}
        selectedDate={selectedDate}
        tl={tl}
      />
    </>
  );
}

export default memo(AttendanceListContentSection);
